// Window capture helper.
//   saveit-window-bounds.exe <hwnd>        prints the visible frame size as JSON; no screen pixels are read.
//   saveit-window-bounds.exe grab <hwnd>   (10.5.3) writes the window's own picture to standard output:
//                                          "SVWC", width, height, method (three 32-bit integers), then width*height*4
//                                          bytes (BGRA, top row first). Nothing is written to disk.
// Why the picture is read here: Electron's window thumbnails are the whole window rectangle (with the invisible resize
// borders Windows puts around most windows) scaled to fit the size asked for, so they matched the visible frame only for
// borderless windows; every other window failed with "The window changed size during capture".
// The picture comes from the window itself (PrintWindow with PW_RENDERFULLCONTENT), so it is right even when other
// windows cover it, and is cut to the visible frame Windows reports (DWMWA_EXTENDED_FRAME_BOUNDS). A window that gives
// no picture that way is brought to the front and read from the screen instead. A minimized window is restored first.
using System;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
internal static class WindowBounds {
    [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] struct BitmapInfoHeader { public int biSize, biWidth, biHeight; public short biPlanes, biBitCount; public int biCompression, biSizeImage, biXPelsPerMeter, biYPelsPerMeter, biClrUsed, biClrImportant; }
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd, int cmd);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
    [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hwnd, IntPtr dc, int flags);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr hwnd);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr hwnd, int flags);
    [DllImport("user32.dll")] static extern int GetSystemMetrics(int index);
    [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr hwnd);
    [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr hwnd, IntPtr dc);
    [DllImport("user32.dll")] static extern IntPtr SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll")] static extern IntPtr GetWindowDpiAwarenessContext(IntPtr hwnd);
    [DllImport("user32.dll")] static extern int GetAwarenessFromDpiAwarenessContext(IntPtr value);
    [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr dc);
    [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
    [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc, IntPtr obj);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr obj);
    [DllImport("gdi32.dll")] static extern bool BitBlt(IntPtr dst, int x, int y, int w, int h, IntPtr src, int sx, int sy, int rop);
    [DllImport("gdi32.dll")] static extern IntPtr CreateDIBSection(IntPtr dc, ref BitmapInfoHeader bmi, int usage, out IntPtr bits, IntPtr section, int offset);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr hwnd, int attribute, out Rect rect, int size);
    const int SRCCOPY = 0x00CC0020, MAX = 32768;
    static bool Frame(IntPtr hwnd, out Rect rect) {
        // DWMWA_EXTENDED_FRAME_BOUNDS is in physical pixels, independent of this process's DPI awareness.
        return DwmGetWindowAttribute(hwnd, 9, out rect, Marshal.SizeOf(typeof(Rect))) == 0;
    }
    static int Main(string[] args) {
        bool grab = args.Length == 2 && args[0] == "grab";
        ulong value;
        if ((!grab && args.Length != 1) || !ulong.TryParse(args[args.Length - 1], NumberStyles.None, CultureInfo.InvariantCulture, out value) || value == 0 || value > long.MaxValue) return 2;
        IntPtr hwnd = new IntPtr((long)value);
        if (!IsWindow(hwnd)) return 3;
        if (grab) return Grab(hwnd);
        if (IsIconic(hwnd)) return 3;
        Rect rect;
        if (!Frame(hwnd, out rect)) return 4;
        long width = (long)rect.Right - rect.Left, height = (long)rect.Bottom - rect.Top;
        if (width < 1 || height < 1 || width > MAX || height > MAX) return 5;
        Console.WriteLine("{\"width\":" + width + ",\"height\":" + height + "}");
        return 0;
    }
    // Exit codes: 3 the window is gone, 4 Windows gave no frame, 5 impossible size, 6 no picture could be read,
    // 7 the window is minimized and did not come back.
    static int Grab(IntPtr hwnd) {
        try { if (SetProcessDpiAwarenessContext(new IntPtr(-4)) == IntPtr.Zero) SetProcessDPIAware(); } catch (EntryPointNotFoundException) { SetProcessDPIAware(); }
        if (IsIconic(hwnd)) {
            ShowWindow(hwnd, 4); // SW_SHOWNOACTIVATE: back to its last size, without taking the keyboard
            for (int i = 0; i < 40 && IsIconic(hwnd); i++) Thread.Sleep(50);
            if (!IsWindow(hwnd)) return 3;
            if (IsIconic(hwnd)) return 7;
            Thread.Sleep(450); // the restore animation and the window's first repaint
        }
        Rect frame, phys, own;
        if (!Frame(hwnd, out frame)) return IsWindow(hwnd) ? 4 : 3;
        int fw = frame.Right - frame.Left, fh = frame.Bottom - frame.Top;
        if (fw < 1 || fh < 1 || fw > MAX || fh > MAX) return 5;
        if (!GetWindowRect(hwnd, out phys)) return IsWindow(hwnd) ? 4 : 3;
        // A window that Windows scales (one that is not aware of this monitor's scaling) draws itself in its own, smaller
        // units. Measure it the way it measures itself, so its picture is cut in the right place.
        own = phys;
        IntPtr before = IntPtr.Zero; bool switched = false;
        try {
            int aware = GetAwarenessFromDpiAwarenessContext(GetWindowDpiAwarenessContext(hwnd));
            if (aware == 0 || aware == 1) { before = SetThreadDpiAwarenessContext(new IntPtr(aware == 0 ? -1 : -2)); switched = before != IntPtr.Zero; if (switched && !GetWindowRect(hwnd, out own)) own = phys; }
        } catch (EntryPointNotFoundException) { }
        int ow = own.Right - own.Left, oh = own.Bottom - own.Top, pw = phys.Right - phys.Left, ph = phys.Bottom - phys.Top;
        byte[] pixels = null; int outW = 0, outH = 0, method = 0; bool plain = false;
        IntPtr screen = GetDC(IntPtr.Zero), mem = CreateCompatibleDC(screen);
        try {
            if (ow > 0 && oh > 0 && ow <= MAX && oh <= MAX && pw > 0 && ph > 0) {
                byte[] whole = Read(mem, ow, oh, delegate(IntPtr dc) { return PrintWindow(hwnd, dc, 2); }); // PW_RENDERFULLCONTENT
                if (whole != null) {
                    double sx = (double)ow / pw, sy = (double)oh / ph;
                    int cx = Math.Max(0, (int)Math.Round((frame.Left - phys.Left) * sx)), cy = Math.Max(0, (int)Math.Round((frame.Top - phys.Top) * sy));
                    int cw = Math.Min(ow - cx, sx == 1 ? fw : (int)Math.Round(fw * sx)), ch = Math.Min(oh - cy, sy == 1 ? fh : (int)Math.Round(fh * sy));
                    if (cw > 0 && ch > 0) {
                        pixels = new byte[cw * ch * 4];
                        for (int y = 0; y < ch; y++) Buffer.BlockCopy(whole, ((cy + y) * ow + cx) * 4, pixels, y * cw * 4, cw * 4);
                        outW = cw; outH = ch; method = 1; plain = Plain(pixels);
                    }
                }
            }
            if (switched) { SetThreadDpiAwarenessContext(before); switched = false; }
            if (pixels == null || plain) {
                // No picture from the window itself (some programs that draw straight to the graphics card): bring it to
                // the front and read the screen where it is. Used only when Windows really put it in front.
                SetForegroundWindow(hwnd); BringWindowToTop(hwnd);
                bool front = false;
                for (int i = 0; i < 12 && !front; i++) { Thread.Sleep(50); IntPtr fg = GetForegroundWindow(); front = fg == hwnd || (fg != IntPtr.Zero && GetAncestor(fg, 3) == hwnd); } // GA_ROOTOWNER
                if (front && Frame(hwnd, out frame)) {
                    Thread.Sleep(150);
                    int vx = GetSystemMetrics(76), vy = GetSystemMetrics(77), vw = GetSystemMetrics(78), vh = GetSystemMetrics(79);
                    int x0 = Math.Max(frame.Left, vx), y0 = Math.Max(frame.Top, vy), x1 = Math.Min(frame.Right, vx + vw), y1 = Math.Min(frame.Bottom, vy + vh);
                    if (x1 > x0 && y1 > y0) {
                        byte[] shot = Read(mem, x1 - x0, y1 - y0, delegate(IntPtr dc) { return BitBlt(dc, 0, 0, x1 - x0, y1 - y0, screen, x0, y0, SRCCOPY); });
                        if (shot != null && (pixels == null || !Plain(shot))) { pixels = shot; outW = x1 - x0; outH = y1 - y0; method = 2; }
                    }
                }
            }
        } finally {
            if (switched) SetThreadDpiAwarenessContext(before);
            DeleteDC(mem); ReleaseDC(IntPtr.Zero, screen);
        }
        if (pixels == null) return IsWindow(hwnd) ? 6 : 3;
        for (int i = 3; i < pixels.Length; i += 4) pixels[i] = 255;
        Stream output = Console.OpenStandardOutput();
        byte[] head = new byte[16];
        head[0] = (byte)'S'; head[1] = (byte)'V'; head[2] = (byte)'W'; head[3] = (byte)'C';
        BitConverter.GetBytes(outW).CopyTo(head, 4); BitConverter.GetBytes(outH).CopyTo(head, 8); BitConverter.GetBytes(method).CopyTo(head, 12);
        output.Write(head, 0, 16); output.Write(pixels, 0, pixels.Length); output.Flush();
        return 0;
    }
    delegate bool Draw(IntPtr dc);
    static byte[] Read(IntPtr mem, int w, int h, Draw draw) {
        BitmapInfoHeader bi = new BitmapInfoHeader { biSize = Marshal.SizeOf(typeof(BitmapInfoHeader)), biWidth = w, biHeight = -h, biPlanes = 1, biBitCount = 32 };
        IntPtr bits, dib = CreateDIBSection(mem, ref bi, 0, out bits, IntPtr.Zero, 0);
        if (dib == IntPtr.Zero) return null;
        IntPtr old = SelectObject(mem, dib);
        try {
            if (!draw(mem)) return null;
            byte[] buf = new byte[w * h * 4];
            Marshal.Copy(bits, buf, 0, buf.Length);
            return buf;
        } finally { SelectObject(mem, old); DeleteObject(dib); }
    }
    // One flat colour everywhere: what a window that cannot be read this way gives back (usually all black).
    static bool Plain(byte[] p) {
        for (int i = 4; i < p.Length; i += 4) if (p[i] != p[0] || p[i + 1] != p[1] || p[i + 2] != p[2]) return false;
        return true;
    }
}
