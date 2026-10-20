// Saveit Setup: one file the user downloads and double-clicks. Shows a Saveit-branded window with a progress bar while it installs.
// It carries the release zip inside itself, unpacks it to a temporary folder and runs the normal install.ps1 with -FromSetup,
// so the install logic is the same one Install.cmd uses. Built by tools/build-setup.ps1 (C# compiler that ships with Windows).
using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.IO.Compression;
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
    static void Main()
    {
        try { SetProcessDPIAware(); } catch { }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new SetupForm());
    }
}

class FlatBtn : Button
{
    public FlatBtn(bool primary)
    {
        AccessibleRole = AccessibleRole.PushButton; FlatStyle = FlatStyle.Flat; FlatAppearance.BorderSize = 0; Cursor = Cursors.Hand; UseVisualStyleBackColor = false; TabStop = true;
        BackColor = primary ? SetupForm.Teal : Color.FromArgb(48, 52, 58); ForeColor = primary ? Color.FromArgb(6, 33, 29) : SetupForm.Ink;
        FlatAppearance.MouseOverBackColor = primary ? Color.FromArgb(70, 200, 182) : Color.FromArgb(62, 67, 74);
        FlatAppearance.MouseDownBackColor = primary ? Color.FromArgb(36, 150, 134) : Color.FromArgb(40, 44, 49);
        Font = new Font("Segoe UI Semibold", 11f);
    }
    protected override void OnSizeChanged(EventArgs e)
    {
        base.OnSizeChanged(e);
        using (var p = new GraphicsPath())
        {
            int r = Math.Min(Height / 2, 12) * 2; p.AddArc(0, 0, r, r, 180, 90); p.AddArc(Width - r, 0, r, r, 270, 90); p.AddArc(Width - r, Height - r, r, r, 0, 90); p.AddArc(0, Height - r, r, r, 90, 90); p.CloseFigure();
            Region = new Region(p);
        }
    }
}

class SetupForm : Form
{
    public static readonly Color Teal = Color.FromArgb(45, 179, 160), Ink = Color.FromArgb(232, 234, 236), Muted = Color.FromArgb(154, 161, 168), Bg = Color.FromArgb(22, 24, 26), Red = Color.FromArgb(229, 72, 59);
    enum Page { Welcome, Installing, Done, Error }
    Page page = Page.Welcome;
    float k = 1f;
    Image logo;
    string version = "", status = "", error = "", logPath;
    float shown = 0, target = 0;
    int shimmer = 0;
    bool busy = false;
    string dest;
    FlatBtn primary, secondary;
    System.Windows.Forms.Timer timer;

    int S(int v) { return (int)Math.Round(v * k); }

    public SetupForm()
    {
        using (var g = CreateGraphics()) k = g.DpiX / 96f;
        Text = "Saveit Setup"; AutoScaleMode = AutoScaleMode.None; FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; MinimizeBox = true;
        StartPosition = FormStartPosition.CenterScreen; BackColor = Bg; DoubleBuffered = true; ClientSize = new Size(S(560), S(410));
        try { using (var s = Res("app.ico")) Icon = new Icon(s); } catch { }
        try { using (var s = Res("logo.png")) logo = Image.FromStream(new MemoryStream(ReadAll(s))); } catch { }
        version = ReadVersion();
        string root = Environment.GetEnvironmentVariable("SAVEIT_SETUP_TEST_ROOT");
        bool test = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SAVEIT_REVIEW_DATA")) && !string.IsNullOrEmpty(root);
        dest = test ? Path.Combine(root, "Programs", "Saveit") : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Saveit");
        logPath = Path.Combine(Path.GetTempPath(), "Saveit-Setup.log");
        primary = new FlatBtn(true); secondary = new FlatBtn(false);
        primary.Click += delegate { OnPrimary(); }; secondary.Click += delegate { if (page == Page.Error) { try { Process.Start("notepad.exe", "\"" + logPath + "\""); } catch { } } else { Close(); } };
        Controls.Add(primary); Controls.Add(secondary);
        AcceptButton = primary;
        timer = new System.Windows.Forms.Timer(); timer.Interval = 30; timer.Tick += delegate
        {
            if (page != Page.Installing) { return; }
            shown += (target - shown) * 0.12f; shimmer = (shimmer + 6) % 1000; Invalidate(new Rectangle(0, S(255), ClientSize.Width, S(60)));
        };
        timer.Start();
        FormClosing += delegate (object s, FormClosingEventArgs e) { if (busy && e.CloseReason == CloseReason.UserClosing) { e.Cancel = true; } };
        SetPage(Page.Welcome);
    }

    static Stream Res(string name) { return Assembly.GetExecutingAssembly().GetManifestResourceStream(name); }
    static byte[] ReadAll(Stream s) { var ms = new MemoryStream(); s.CopyTo(ms); return ms.ToArray(); }

    string ReadVersion()
    {
        try
        {
            using (var z = new ZipArchive(new MemoryStream(ReadAll(Res("payload.zip"))), ZipArchiveMode.Read))
            foreach (var e in z.Entries)
                if (e.FullName.EndsWith("app/package.json"))
                    using (var r = new StreamReader(e.Open()))
                    { var m = Regex.Match(r.ReadToEnd(), "\"version\"\\s*:\\s*\"([^\"]+)\""); if (m.Success) return m.Groups[1].Value; }
        }
        catch { }
        return "";
    }

    void SetPage(Page p)
    {
        page = p;
        primary.Visible = secondary.Visible = true;
        int bw = S(170), sw = S(120), bh = S(42), y = S(318), gap = S(14);
        switch (p)
        {
            case Page.Welcome: primary.Text = "Install"; secondary.Text = "Cancel"; break;
            case Page.Installing: primary.Visible = false; secondary.Visible = false; break;
            case Page.Done: primary.Text = "Open Saveit"; secondary.Text = "Close"; break;
            case Page.Error: primary.Text = "Close"; secondary.Text = "Show details"; break;
        }
        primary.SetBounds((ClientSize.Width - (bw + gap + sw)) / 2, y, bw, bh);
        secondary.SetBounds(primary.Right + gap, y, sw, bh);
        if (p == Page.Welcome && IsHandleCreated) { primary.Focus(); }
        Invalidate();
    }

    void OnPrimary()
    {
        if (page == Page.Welcome) { StartInstall(); }
        else if (page == Page.Done)
        {
            try { Process.Start(new ProcessStartInfo(Path.Combine(dest, "Saveit.exe")) { WorkingDirectory = dest, UseShellExecute = false }); } catch { }
            Close();
        }
        else { Close(); }
    }

    static void Log(string path, string line) { try { File.AppendAllText(path, DateTime.Now.ToString("HH:mm:ss ") + line + "\r\n"); } catch { } }

    void StartInstall()
    {
        // Saveit must not be open while its files are replaced. Ask first; never close it silently.
        try
        {
            string exe = Path.Combine(dest, "Saveit.exe"); bool running = false;
            foreach (var pr in Process.GetProcessesByName("Saveit"))
            { try { if (string.Equals(pr.MainModule.FileName, exe, StringComparison.OrdinalIgnoreCase)) running = true; } catch { } }
            if (running)
            {
                var a = MessageBox.Show(this, "Saveit is open. Setup needs to close it to finish. Your library is saved automatically, but save any file or recording you are working on first.\n\nClose Saveit and continue?", "Saveit Setup", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
                if (a != DialogResult.Yes) return;
            }
        }
        catch { }
        busy = true; target = shown = 0; status = "Getting ready..."; error = "";
        try { File.WriteAllText(logPath, ""); } catch { }
        SetPage(Page.Installing);
        var t = new Thread(Work); t.IsBackground = true; t.Start();
    }

    void Progress(int pct, string text) { BeginInvoke((MethodInvoker)delegate { target = pct; status = text; Invalidate(new Rectangle(0, S(255), ClientSize.Width, S(60))); }); }

    void Work()
    {
        string tmp = Path.Combine(Path.GetTempPath(), "Saveit-Setup-" + Guid.NewGuid().ToString("N").Substring(0, 8)), err = null; int code = -1;
        try
        {
            Directory.CreateDirectory(tmp);
            Progress(2, "Getting ready...");
            string zipPath = Path.Combine(tmp, "payload.zip");
            using (var s = Res("payload.zip")) using (var f = File.Create(zipPath)) s.CopyTo(f);
            ZipFile.ExtractToDirectory(zipPath, tmp);
            File.Delete(zipPath);
            string script = Directory.GetFiles(tmp, "install.ps1", SearchOption.AllDirectories)[0];
            var psi = new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), @"WindowsPowerShell\v1.0\powershell.exe"),
                "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + script + "\" -FromSetup")
            { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8, WorkingDirectory = Path.GetDirectoryName(script) };
            using (var p = Process.Start(psi))
            {
                var errText = new StringBuilder();
                p.ErrorDataReceived += delegate (object o, DataReceivedEventArgs ea) { if (ea.Data != null) { errText.AppendLine(ea.Data); Log(logPath, "stderr: " + ea.Data); } };
                p.BeginErrorReadLine();
                string line;
                while ((line = p.StandardOutput.ReadLine()) != null)
                {
                    Log(logPath, line);
                    var m = Regex.Match(line, @"^##P (\d+) (.*)$");
                    if (m.Success) { Progress(int.Parse(m.Groups[1].Value), m.Groups[2].Value); continue; }
                    m = Regex.Match(line, @"^##E (.*)$");
                    if (m.Success) { err = m.Groups[1].Value; }
                }
                p.WaitForExit(); code = p.ExitCode;
                if (code != 0 && err == null) { err = errText.Length > 0 ? errText.ToString().Trim() : "The installer stopped unexpectedly (code " + code + ")."; }
            }
        }
        catch (Exception ex) { err = ex.Message; Log(logPath, "exception: " + ex); }
        try { Directory.Delete(tmp, true); } catch { }
        BeginInvoke((MethodInvoker)delegate
        {
            busy = false;
            if (code == 0 && err == null) { target = 100; shown = 100; status = ""; SetPage(Page.Done); }
            else { error = err ?? "Setup did not finish."; SetPage(Page.Error); }
        });
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias; g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        int w = ClientSize.Width, ls = S(92);
        if (logo != null) g.DrawImage(logo, (w - ls) / 2, S(34), ls, ls);
        string title = "", sub = "";
        switch (page)
        {
            case Page.Welcome: title = "Install Saveit"; sub = (version != "" ? "Version " + version + "\n" : "") + "Screen capture, recording and markup for Windows."; break;
            case Page.Installing: title = "Installing Saveit..."; sub = "This takes a minute. Please keep this window open."; break;
            case Page.Done: title = "Saveit is ready"; sub = "It was installed" + (version != "" ? " (version " + version + ")" : "") + ". Shortcuts were added to your Start menu and desktop."; break;
            case Page.Error: title = "Setup could not finish"; sub = error + "\nNothing was changed on your library or settings."; break;
        }
        using (var f = new Font("Segoe UI Semibold", 20f)) TextRenderer.DrawText(g, title, f, new Rectangle(S(20), S(140), w - S(40), S(40)), page == Page.Error ? Red : Ink, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
        using (var f = new Font("Segoe UI", 10.5f)) TextRenderer.DrawText(g, sub, f, new Rectangle(S(50), S(184), w - S(100), page == Page.Error ? S(90) : S(60)), Muted, TextFormatFlags.HorizontalCenter | TextFormatFlags.Top | TextFormatFlags.WordBreak | TextFormatFlags.NoPadding);
        if (page == Page.Installing)
        {
            int bw = S(380), bh = S(8), bx = (w - bw) / 2, by = S(262);
            using (var b = new SolidBrush(Color.FromArgb(48, 52, 58))) FillRound(g, b, bx, by, bw, bh);
            int fw = Math.Max(bh, (int)(bw * Math.Min(100f, shown) / 100f));
            using (var b = new SolidBrush(Teal)) FillRound(g, b, bx, by, fw, bh);
            int sx = bx + (int)((shimmer / 1000f) * (fw + S(80))) - S(80);
            var clip = new Rectangle(bx, by, fw, bh); var old = g.Clip; g.SetClip(clip);
            using (var b = new LinearGradientBrush(new Rectangle(sx, by, S(80), bh), Color.FromArgb(0, 255, 255, 255), Color.FromArgb(70, 255, 255, 255), LinearGradientMode.Horizontal)) { var bl = new ColorBlend(3); bl.Colors = new[] { Color.FromArgb(0, 255, 255, 255), Color.FromArgb(80, 255, 255, 255), Color.FromArgb(0, 255, 255, 255) }; bl.Positions = new[] { 0f, .5f, 1f }; b.InterpolationColors = bl; g.FillRectangle(b, sx, by, S(80), bh); }
            g.Clip = old;
            using (var f = new Font("Segoe UI", 10f)) TextRenderer.DrawText(g, status, f, new Rectangle(S(40), by + S(16), w - S(80), S(24)), Muted, TextFormatFlags.HorizontalCenter | TextFormatFlags.Top | TextFormatFlags.NoPadding | TextFormatFlags.EndEllipsis);
        }
        string foot = page == Page.Welcome ? "Installs for your Windows account only. No administrator rights needed." : page == Page.Done ? "You can remove Saveit any time from Settings > Apps." : "";
        if (foot != "") using (var f = new Font("Segoe UI", 9f)) TextRenderer.DrawText(g, foot, f, new Rectangle(S(20), ClientSize.Height - S(40), w - S(40), S(24)), Color.FromArgb(112, 118, 124), TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
    }

    static void FillRound(Graphics g, Brush b, int x, int y, int w, int h)
    {
        using (var p = new GraphicsPath()) { int r = h; p.AddArc(x, y, r, r, 90, 180); p.AddArc(x + w - r, y, r, r, 270, 180); p.CloseFigure(); g.FillPath(b, p); }
    }

    protected override void OnLoad(EventArgs e) { base.OnLoad(e); primary.Focus(); }

    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        if (keyData == Keys.Escape && !busy) { Close(); return true; }
        return base.ProcessCmdKey(ref msg, keyData);
    }
}
