// Physical visible window bounds; no screen pixels or user data are read here.
using System;
using System.Globalization;
using System.Runtime.InteropServices;
internal static class WindowBounds {
    [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr hwnd, int attribute, out Rect rect, int size);
    static int Main(string[] args) {
        ulong value;
        if (args.Length != 1 || !ulong.TryParse(args[0], NumberStyles.None, CultureInfo.InvariantCulture, out value) || value == 0 || value > long.MaxValue) return 2;
        IntPtr hwnd = new IntPtr((long)value);
        if (!IsWindow(hwnd) || IsIconic(hwnd)) return 3;
        Rect rect;
        // DWMWA_EXTENDED_FRAME_BOUNDS is in physical pixels, independent of this process's DPI awareness.
        if (DwmGetWindowAttribute(hwnd, 9, out rect, Marshal.SizeOf(typeof(Rect))) != 0) return 4;
        long width = (long)rect.Right - rect.Left, height = (long)rect.Bottom - rect.Top;
        if (width < 1 || height < 1 || width > 32768 || height > 32768) return 5;
        Console.WriteLine("{\"width\":" + width + ",\"height\":" + height + "}");
        return 0;
    }
}
