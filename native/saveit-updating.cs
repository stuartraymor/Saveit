// Saveit "Updating" window. Saveit starts this (from a copy in its update staging folder) after the person chose Install and Saveit has been asked to close.
// It shows the Saveit logo and a progress bar while it runs the real updater (updater.ps1, hidden) and reads its "##P percent text" / "##E message" lines.
// The update itself is done entirely by updater.ps1; this program only shows progress. If the updater cannot even be started, it starts Saveit again.
//   saveit-updating.exe <path to updater.ps1> <the updater's own arguments...>
// Built by tools/build-updating.ps1 into app\saveit-updating.exe (C# compiler that ships with Windows).
using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

static class Program
{
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [STAThread]
    static void Main(string[] args)
    {
        try { SetProcessDPIAware(); } catch { }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new UpdatingForm(args));
    }
}

class UpdatingForm : Form
{
    static readonly Color Teal = Color.FromArgb(45, 179, 160), Ink = Color.FromArgb(232, 234, 236), Muted = Color.FromArgb(154, 161, 168), Bg = Color.FromArgb(22, 24, 26), Red = Color.FromArgb(229, 72, 59);
    enum Page { Working, Done, Error }
    Page page = Page.Working;
    float k = 1f, shown = 0, target = 0;
    int shimmer = 0, lastPct = 0;
    string status = "Getting ready...", error = "", version = "", installDir = "", logoDir;
    Image logo;
    string[] args;
    Button closeBtn;
    System.Windows.Forms.Timer timer;

    int S(int v) { return (int)Math.Round(v * k); }
    static Stream Res(string n) { return Assembly.GetExecutingAssembly().GetManifestResourceStream(n); }

    public UpdatingForm(string[] a)
    {
        args = a;
        for (int i = 0; i + 1 < a.Length; i++) { if (a[i] == "-NewVersion") version = a[i + 1]; if (a[i] == "-InstallDir") installDir = a[i + 1]; }
        using (var g = CreateGraphics()) k = g.DpiX / 96f;
        Text = "Updating Saveit"; AutoScaleMode = AutoScaleMode.None; FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; MinimizeBox = false; ControlBox = false;
        StartPosition = FormStartPosition.CenterScreen; BackColor = Bg; DoubleBuffered = true; TopMost = true; ClientSize = new Size(S(520), S(340));
        try { using (var s = Res("app.ico")) Icon = new Icon(s); } catch { }
        try { using (var s = Res("logo.png")) { var ms = new MemoryStream(); s.CopyTo(ms); logo = Image.FromStream(ms); } } catch { }
        closeBtn = new Button { Text = "Close", FlatStyle = FlatStyle.Flat, Visible = false, Cursor = Cursors.Hand, BackColor = Color.FromArgb(48, 52, 58), ForeColor = Ink, Font = new Font("Segoe UI Semibold", 11f), UseVisualStyleBackColor = false };
        closeBtn.FlatAppearance.BorderSize = 0; closeBtn.SetBounds((ClientSize.Width - S(130)) / 2, S(268), S(130), S(40)); closeBtn.Click += delegate { Close(); };
        Controls.Add(closeBtn); AcceptButton = closeBtn;
        timer = new System.Windows.Forms.Timer { Interval = 30 };
        timer.Tick += delegate { if (page != Page.Working) return; shown += (target - shown) * 0.12f; shimmer = (shimmer + 6) % 1000; Invalidate(new Rectangle(0, S(215), ClientSize.Width, S(70))); };
        timer.Start();
        Shown += delegate { var t = new Thread(Run); t.IsBackground = true; t.Start(); };
    }

    void Progress(int pct, string text) { BeginInvoke((MethodInvoker)delegate { target = pct; status = text; Invalidate(new Rectangle(0, S(215), ClientSize.Width, S(70))); }); }

    void Run()
    {
        string err = null; int code = -1;
        try
        {
            if (args.Length < 1) throw new Exception("No updater script was given.");
            var sb = new StringBuilder("-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File");
            foreach (var a in args) sb.Append(" \"").Append(a.Replace("\"", "")).Append('"');
            var psi = new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), @"WindowsPowerShell\v1.0\powershell.exe"), sb.ToString())
            { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8 };
            using (var p = Process.Start(psi))
            {
                p.ErrorDataReceived += delegate { }; p.BeginErrorReadLine();
                string line;
                while ((line = p.StandardOutput.ReadLine()) != null)
                {
                    var m = Regex.Match(line, @"^##P (\d+) (.*)$");
                    if (m.Success) { lastPct = int.Parse(m.Groups[1].Value); Progress(lastPct, m.Groups[2].Value); continue; }
                    m = Regex.Match(line, @"^##E (.*)$");
                    if (m.Success) err = m.Groups[1].Value;
                }
                p.WaitForExit(); code = p.ExitCode;
            }
        }
        catch (Exception ex)
        {
            // The updater could not be started at all: nothing was changed, so bring Saveit back.
            err = "The update could not be started, so nothing was changed. Saveit is opening again.";
            try { if (installDir != "") Process.Start(new ProcessStartInfo(Path.Combine(installDir, "Saveit.exe")) { WorkingDirectory = installDir, UseShellExecute = false }); } catch { }
            try { File.AppendAllText(Path.Combine(Path.GetTempPath(), "Saveit-Update-UI.log"), DateTime.Now + " " + ex + "\r\n"); } catch { }
            code = 1;
        }
        BeginInvoke((MethodInvoker)delegate
        {
            if (code == 0 && lastPct >= 100) { page = Page.Done; target = shown = 100; Invalidate(); var t = new System.Windows.Forms.Timer { Interval = 1800 }; t.Tick += delegate { Close(); }; t.Start(); }
            else if (code == 0) { Close(); }   // cancelled or nothing to do: the updater changed nothing
            else { error = err ?? "The update did not finish. Saveit put your previous version back."; page = Page.Error; closeBtn.Visible = true; Invalidate(); }
        });
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias; g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        int w = ClientSize.Width, ls = S(88);
        if (logo != null) g.DrawImage(logo, (w - ls) / 2, S(30), ls, ls);
        string title = page == Page.Done ? "Update complete" : page == Page.Error ? "The update did not finish" : "Updating Saveit" + (version != "" ? " to " + version : "") + "...";
        string sub = page == Page.Done ? "Opening Saveit " + version + "..." : page == Page.Error ? error : "Please wait. Saveit will open again by itself.";
        using (var f = new Font("Segoe UI Semibold", 18f)) TextRenderer.DrawText(g, title, f, new Rectangle(S(20), S(128), w - S(40), S(40)), page == Page.Error ? Red : Ink, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
        using (var f = new Font("Segoe UI", 10.5f)) TextRenderer.DrawText(g, sub, f, new Rectangle(S(40), S(172), w - S(80), page == Page.Error ? S(80) : S(30)), Muted, TextFormatFlags.HorizontalCenter | TextFormatFlags.Top | TextFormatFlags.WordBreak | TextFormatFlags.NoPadding);
        if (page != Page.Error)
        {
            int bw = S(360), bh = S(8), bx = (w - bw) / 2, by = S(226);
            using (var b = new SolidBrush(Color.FromArgb(48, 52, 58))) Pill(g, b, bx, by, bw, bh);
            int fw = Math.Max(bh, (int)(bw * Math.Min(100f, shown) / 100f));
            using (var b = new SolidBrush(Teal)) Pill(g, b, bx, by, fw, bh);
            if (page == Page.Working)
            {
                int sx = bx + (int)((shimmer / 1000f) * (fw + S(80))) - S(80); var old = g.Clip; g.SetClip(new Rectangle(bx, by, fw, bh));
                using (var b = new LinearGradientBrush(new Rectangle(sx, by, S(80), bh), Color.White, Color.White, LinearGradientMode.Horizontal))
                { var bl = new ColorBlend(3); bl.Colors = new[] { Color.FromArgb(0, 255, 255, 255), Color.FromArgb(80, 255, 255, 255), Color.FromArgb(0, 255, 255, 255) }; bl.Positions = new[] { 0f, .5f, 1f }; b.InterpolationColors = bl; g.FillRectangle(b, sx, by, S(80), bh); }
                g.Clip = old;
                using (var f = new Font("Segoe UI", 10f)) TextRenderer.DrawText(g, status, f, new Rectangle(S(30), by + S(16), w - S(60), S(24)), Muted, TextFormatFlags.HorizontalCenter | TextFormatFlags.Top | TextFormatFlags.NoPadding | TextFormatFlags.EndEllipsis);
            }
        }
    }

    static void Pill(Graphics g, Brush b, int x, int y, int w, int h)
    {
        using (var p = new GraphicsPath()) { int r = h; p.AddArc(x, y, r, r, 90, 180); p.AddArc(x + w - r, y, r, r, 270, 180); p.CloseFigure(); g.FillPath(b, p); }
    }
}
