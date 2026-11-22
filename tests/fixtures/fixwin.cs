// Test fixture: an ordinary Windows program window (title bar, resize borders) with four coloured quarters.
using System; using System.Drawing; using System.Windows.Forms; using System.Runtime.InteropServices;
static class FixWin {
  [DllImport("user32.dll")] static extern IntPtr SetProcessDpiAwarenessContext(IntPtr v);
  [STAThread] static void Main(string[] a) {
    SetProcessDpiAwarenessContext(new IntPtr(-4));
    var f = new Form(); f.Text = a[4]; f.StartPosition = FormStartPosition.Manual; f.AutoScaleMode = AutoScaleMode.None;
    if (a.Length > 5 && a[5] == "borderless") f.FormBorderStyle = FormBorderStyle.None;
    f.Bounds = new Rectangle(int.Parse(a[0]), int.Parse(a[1]), int.Parse(a[2]), int.Parse(a[3]));
    f.Paint += (s, e) => { int w = f.ClientSize.Width, h = f.ClientSize.Height; var g = e.Graphics;
      g.FillRectangle(Brushes.Red, 0, 0, w / 2, h / 2); g.FillRectangle(Brushes.Lime, w / 2, 0, w - w / 2, h / 2);
      g.FillRectangle(Brushes.Blue, 0, h / 2, w / 2, h - h / 2); g.FillRectangle(Brushes.Yellow, w / 2, h / 2, w - w / 2, h - h / 2); };
    f.Resize += (s, e) => f.Invalidate();
    f.Shown += (s, e) => { Console.WriteLine(f.Handle.ToInt64()); Console.Out.Flush(); };
    Application.Run(f);
  } }
