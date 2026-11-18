// 10.3.10: fast exact screen reads for scrolling capture. Saveit starts this helper for one scrolling capture
// session and sends one line per look: "x y w h" in physical virtual-screen pixels. The helper answers with
// exactly w*h*4 bytes (BGRA, top row first) read from the screen with GDI, which gives the true pixels (no video
// compression) and never includes the mouse pointer. It reads only the rectangle it is asked for, writes nothing
// to disk, and exits when Saveit closes its input or sends "q".
using System;
using System.IO;
using System.Runtime.InteropServices;
internal static class RegionGrab {
    [StructLayout(LayoutKind.Sequential)] struct BitmapInfoHeader { public int biSize, biWidth, biHeight; public short biPlanes, biBitCount; public int biCompression, biSizeImage, biXPelsPerMeter, biYPelsPerMeter, biClrUsed, biClrImportant; }
    [DllImport("user32.dll")] static extern IntPtr SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr hwnd);
    [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr hwnd, IntPtr dc);
    [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr dc);
    [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
    [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc, IntPtr obj);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr obj);
    [DllImport("gdi32.dll")] static extern bool BitBlt(IntPtr dst, int x, int y, int w, int h, IntPtr src, int sx, int sy, int rop);
    [DllImport("gdi32.dll")] static extern IntPtr CreateDIBSection(IntPtr dc, ref BitmapInfoHeader bmi, int usage, out IntPtr bits, IntPtr section, int offset);
    const int SRCCOPY = 0x00CC0020;
    static int Main() {
        // physical pixels on every monitor, whatever its scaling
        try { if (SetProcessDpiAwarenessContext(new IntPtr(-4)) == IntPtr.Zero) SetProcessDPIAware(); } catch (EntryPointNotFoundException) { SetProcessDPIAware(); }
        Stream output = Console.OpenStandardOutput();
        TextReader input = Console.In;
        IntPtr screen = GetDC(IntPtr.Zero), mem = CreateCompatibleDC(screen), dib = IntPtr.Zero, old = IntPtr.Zero, bits = IntPtr.Zero;
        int cw = 0, ch = 0; byte[] buf = new byte[0];
        try {
            string line;
            while ((line = input.ReadLine()) != null) {
                line = line.Trim();
                if (line == "q") break;
                string[] p = line.Split(' ');
                int x, y, w, h;
                if (p.Length != 4 || !int.TryParse(p[0], out x) || !int.TryParse(p[1], out y) || !int.TryParse(p[2], out w) || !int.TryParse(p[3], out h) || w < 1 || h < 1 || w > 16384 || h > 16384) return 2;
                if (w != cw || h != ch) {
                    if (dib != IntPtr.Zero) { SelectObject(mem, old); DeleteObject(dib); }
                    BitmapInfoHeader bi = new BitmapInfoHeader { biSize = Marshal.SizeOf(typeof(BitmapInfoHeader)), biWidth = w, biHeight = -h, biPlanes = 1, biBitCount = 32 };
                    dib = CreateDIBSection(mem, ref bi, 0, out bits, IntPtr.Zero, 0);
                    if (dib == IntPtr.Zero) return 3;
                    old = SelectObject(mem, dib); cw = w; ch = h; buf = new byte[w * h * 4];
                }
                if (!BitBlt(mem, 0, 0, w, h, screen, x, y, SRCCOPY)) Array.Clear(buf, 0, buf.Length);
                else { Marshal.Copy(bits, buf, 0, buf.Length); for (int i = 3; i < buf.Length; i += 4) buf[i] = 255; }
                output.Write(buf, 0, buf.Length); output.Flush();
            }
        } catch (IOException) { }
        finally {
            if (dib != IntPtr.Zero) { SelectObject(mem, old); DeleteObject(dib); }
            DeleteDC(mem); ReleaseDC(IntPtr.Zero, screen);
        }
        return 0;
    }
}
