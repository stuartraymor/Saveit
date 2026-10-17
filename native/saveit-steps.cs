// saveit-steps.exe - Step Capture helper for Saveit (replaces the PowerShell CLICK_WATCHER).
// Build (no SDK needed, uses the C# compiler that ships with Windows):
//   C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /optimize /target:winexe /platform:x64 /out:saveit-steps.exe saveit-steps.cs
// Protocol (one line per event on stdout, same as today):
//   READY
//   CLICK <n> {json}     json = {n,button,double,x,y,name,type,ctype,id,help,value,isPassword,rect:[l,t,w,h],menu,window,app}
//   TYPE <n> {json}      text typed into one field, sent when focus leaves it or Enter/Tab is pressed (password fields are never sent)
// Test without clicking:  saveit-steps.exe --probe <x> <y>   (prints the JSON for that screen point and exits)
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Collections.Concurrent;

static class Program
{
    // ---------- Win32 ----------
    delegate IntPtr HookProc(int code, IntPtr wParam, IntPtr lParam);
    [StructLayout(LayoutKind.Sequential)] struct POINT { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] struct MSLLHOOKSTRUCT { public POINT pt; public uint mouseData, flags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct KBDLLHOOKSTRUCT { public uint vk, scan, flags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam, lParam; public uint time; public POINT pt; }
    [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, HookProc fn, IntPtr mod, uint thread);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr h, int code, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern int GetMessage(out MSG m, IntPtr h, uint a, uint b);
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr v);
    [DllImport("user32.dll")] static extern uint GetDoubleClickTime();
    [DllImport("user32.dll")] static extern int ToUnicode(uint vk, uint scan, byte[] state, StringBuilder buf, int n, uint flags);
    [DllImport("user32.dll")] static extern bool GetKeyboardState(byte[] s);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string n);
    const int WH_KEYBOARD_LL = 13, WH_MOUSE_LL = 14;
    const int WM_LBUTTONDOWN = 0x201, WM_RBUTTONDOWN = 0x204, WM_KEYDOWN = 0x100, WM_SYSKEYDOWN = 0x104;

    // ---------- UI Automation (native COM, the same API Snagit uses) ----------
    [ComImport, Guid("d22108aa-8ac5-49a5-837b-37bbb3d7591e"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IUIAutomationElement
    {
        void SetFocus(); void GetRuntimeId(); void FindFirst(); void FindAll(); void FindFirstBuildCache(); void FindAllBuildCache(); void BuildUpdatedCache();
        [return: MarshalAs(UnmanagedType.Struct)] object GetCurrentPropertyValue(int id);
    }
    [ComImport, Guid("30cbe57d-d9d0-452a-ab13-7ac5ac4825ee"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IUIAutomation
    {
        void CompareElements(); void CompareRuntimeIds(); void GetRootElement(); void ElementFromHandle();
        IUIAutomationElement ElementFromPoint(POINT pt);
        IUIAutomationElement GetFocusedElement();
        void GetRootElementBuildCache(); void ElementFromHandleBuildCache(); void ElementFromPointBuildCache(); void GetFocusedElementBuildCache();
        void CreateTreeWalker(); void get_ControlViewWalker();
        IUIAutomationTreeWalker get_ContentViewWalker_unused(); // placeholder slot, never called
        IUIAutomationTreeWalker get_RawViewWalker();
    }
    [ComImport, Guid("4042c624-389c-4afc-a630-9df854a541fc"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IUIAutomationTreeWalker { IUIAutomationElement GetParentElement(IUIAutomationElement e); }

    const int P_NAME = 30005, P_LOCTYPE = 30004, P_CTYPE = 30003, P_AUTOID = 30011, P_HELP = 30013, P_RECT = 30001, P_PID = 30002, P_ISPWD = 30019, P_VALUE = 30045;
    const int CT_MENUITEM = 50011, CT_MENU = 50009, CT_MENUBAR = 50010, CT_WINDOW = 50032, CT_TAB = 50018, CT_TOOLBAR = 50021;

    static IUIAutomation uia;
    static IUIAutomationTreeWalker walker;
    static readonly BlockingCollection<Action> work = new BlockingCollection<Action>();
    static readonly object outLock = new object();
    static int n;
    static uint lastClickTime; static POINT lastClickPt;
    static StringBuilder typed = new StringBuilder(); static string typedField = null; static bool typedPwd;
    static HookProc mouseProc, keyProc; // kept alive so the GC never frees them

    static void Emit(string line) { lock (outLock) { Console.Out.WriteLine(line); Console.Out.Flush(); } }
    static string J(string s) { if (s == null) return "\"\""; var b = new StringBuilder("\""); foreach (var c in s) { if (c == '"' || c == '\\') b.Append('\\').Append(c); else if (c < 32) b.AppendFormat("\\u{0:x4}", (int)c); else b.Append(c); } return b.Append('"').ToString(); }
    static string S(IUIAutomationElement e, int id) { try { var v = e.GetCurrentPropertyValue(id); return v == null ? "" : v.ToString().Trim(); } catch { return ""; } }
    static int I(IUIAutomationElement e, int id) { try { var v = e.GetCurrentPropertyValue(id); return v is int ? (int)v : 0; } catch { return 0; } }

    static string Describe(int x, int y, string button, bool dbl, int num)
    {
        var p = new POINT { X = x, Y = y };
        var e = uia.ElementFromPoint(p);
        string name = S(e, P_NAME), loc = S(e, P_LOCTYPE), id = S(e, P_AUTOID), help = S(e, P_HELP), value = "";
        int ct = I(e, P_CTYPE); bool pwd = false; try { pwd = (bool)e.GetCurrentPropertyValue(P_ISPWD); } catch { }
        if (!pwd) value = S(e, P_VALUE);
        string rect = "[0,0,0,0]"; try { var r = (double[])e.GetCurrentPropertyValue(P_RECT); rect = string.Format("[{0},{1},{2},{3}]", (int)r[0], (int)r[1], (int)r[2], (int)r[3]); } catch { }
        // Walk up for a name (if the element has none), the menu it is in, and the window title.
        string menu = "", window = "", fallback = "";
        var cur = e;
        for (int i = 0; i < 25 && cur != null; i++)
        {
            IUIAutomationElement par = null; try { par = walker.GetParentElement(cur); } catch { }
            if (par == null) break;
            int pct = I(par, P_CTYPE); string pn = S(par, P_NAME);
            if (fallback == "" && i < 3 && pn != "") fallback = pn;
            if (menu == "" && (pct == CT_MENU || pct == CT_MENUBAR || pct == CT_MENUITEM) && pn != "") menu = pn;
            if (pct == CT_WINDOW && pn != "") window = pn;
            cur = par;
        }
        if (name == "") name = help != "" ? help : fallback;
        string app = ""; try { app = Process.GetProcessById(I(e, P_PID)).ProcessName; } catch { }
        return "{" + string.Format("\"n\":{0},\"button\":{1},\"double\":{2},\"x\":{3},\"y\":{4},\"name\":{5},\"type\":{6},\"ctype\":{7},\"id\":{8},\"help\":{9},\"value\":{10},\"isPassword\":{11},\"rect\":{12},\"menu\":{13},\"window\":{14},\"app\":{15}",
            num, J(button), dbl ? "true" : "false", x, y, J(name), J(loc), ct, J(id), J(help), J(value), pwd ? "true" : "false", rect, J(menu), J(window), J(app)) + "}";
    }

    static void FlushTyping()
    {
        if (typed.Length == 0 && !typedPwd) { typedField = null; return; }
        string text = typedPwd ? "" : typed.ToString(); string field = typedField ?? "";
        int num = Interlocked.Increment(ref n);
        Emit("TYPE " + num + " {\"n\":" + num + ",\"field\":" + J(field) + ",\"text\":" + J(text) + ",\"isPassword\":" + (typedPwd ? "true" : "false") + "}");
        typed.Clear(); typedField = null; typedPwd = false;
    }

    static IntPtr MouseHook(int code, IntPtr w, IntPtr l)
    {
        int msg = w.ToInt32();
        if (code >= 0 && (msg == WM_LBUTTONDOWN || msg == WM_RBUTTONDOWN))
        {
            var d = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(l, typeof(MSLLHOOKSTRUCT));
            bool dbl = msg == WM_LBUTTONDOWN && d.time - lastClickTime <= GetDoubleClickTime() && Math.Abs(d.pt.X - lastClickPt.X) < 4 && Math.Abs(d.pt.Y - lastClickPt.Y) < 4;
            if (msg == WM_LBUTTONDOWN) { lastClickTime = d.time; lastClickPt = d.pt; }
            string btn = msg == WM_RBUTTONDOWN ? "right" : "left"; int x = d.pt.X, y = d.pt.Y;
            // Never block inside the hook: queue the work and return at once.
            work.Add(() => {
                FlushTyping();
                if (dbl) { Emit("DOUBLE"); return; } // Saveit merges this into the previous step
                int num = Interlocked.Increment(ref n);
                Emit("CLICK " + num);                // screenshot first, as today
                try { Emit("INFO " + Describe(x, y, btn, false, num)); } catch (Exception ex) { Emit("INFO {\"n\":" + num + ",\"error\":" + J(ex.Message) + "}"); }
            });
        }
        return CallNextHookEx(IntPtr.Zero, code, w, l);
    }

    static IntPtr KeyHook(int code, IntPtr w, IntPtr l)
    {
        int msg = w.ToInt32();
        if (code >= 0 && (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN))
        {
            var k = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(l, typeof(KBDLLHOOKSTRUCT));
            uint vk = k.vk, scan = k.scan;
            work.Add(() => {
                if (vk == 0x0D || vk == 0x09) { FlushTyping(); return; } // Enter / Tab end a typing step
                if (typedField == null)
                {
                    try { var f = uia.GetFocusedElement(); typedField = S(f, P_NAME); try { typedPwd = (bool)f.GetCurrentPropertyValue(P_ISPWD); } catch { } } catch { typedField = ""; }
                }
                if (typedPwd) return;
                if (vk == 0x08) { if (typed.Length > 0) typed.Length--; return; }
                var state = new byte[256]; GetKeyboardState(state); var sb = new StringBuilder(8);
                if (ToUnicode(vk, scan, state, sb, sb.Capacity, 4) > 0 && !char.IsControl(sb[0])) typed.Append(sb.ToString());
            });
        }
        return CallNextHookEx(IntPtr.Zero, code, w, l);
    }

    [STAThread]
    static int Main(string[] args)
    {
        try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { } // per-monitor v2, so hook points match UIA points
        uia = (IUIAutomation)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("ff48dba4-60ef-4201-aa87-54103eef594e")));
        walker = uia.get_RawViewWalker();
        if (args.Length == 3 && args[0] == "--probe") { Console.WriteLine(Describe(int.Parse(args[1]), int.Parse(args[2]), "left", false, 1)); return 0; }

        // One worker thread does all UIA calls, so the hook callbacks return in microseconds.
        var t = new Thread(() => { uia = (IUIAutomation)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("ff48dba4-60ef-4201-aa87-54103eef594e"))); walker = uia.get_RawViewWalker(); foreach (var a in work.GetConsumingEnumerable()) { try { a(); } catch { } } }) { IsBackground = true };
        t.SetApartmentState(ApartmentState.MTA); t.Start();
        // Quit when Saveit closes our stdin (it kills us on Stop as well).
        new Thread(() => { try { while (Console.In.ReadLine() != null) { } } catch { } Environment.Exit(0); }) { IsBackground = true }.Start();

        mouseProc = MouseHook; keyProc = KeyHook;
        IntPtr mod = GetModuleHandle(null);
        IntPtr hm = SetWindowsHookEx(WH_MOUSE_LL, mouseProc, mod, 0), hk = SetWindowsHookEx(WH_KEYBOARD_LL, keyProc, mod, 0);
        if (hm == IntPtr.Zero) { Emit("ERROR mouse hook " + Marshal.GetLastWin32Error()); return 1; }
        Emit("READY");
        MSG m; while (GetMessage(out m, IntPtr.Zero, 0, 0) > 0) { } // low-level hooks need a message loop
        UnhookWindowsHookEx(hm); if (hk != IntPtr.Zero) UnhookWindowsHookEx(hk);
        return 0;
    }
}
