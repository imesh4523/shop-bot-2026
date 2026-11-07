using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;

namespace KeyboardDebouncer
{
    class Program
    {
        private const int WH_KEYBOARD_LL = 13;
        private const int WM_KEYDOWN = 0x0100;
        private const int WM_KEYUP = 0x0101;
        private const int WM_SYSKEYDOWN = 0x0104;
        private const int WM_SYSKEYUP = 0x0105;

        private const int VK_1 = 0x31;       // 1 key
        private const int VK_NUMPAD1 = 0x61; // Numpad 1

        private const long MIN_INTERVAL_MS = 300;

        private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
        private static LowLevelKeyboardProc _proc;
        private static IntPtr _hookID = IntPtr.Zero;
        private static readonly Stopwatch _sw = Stopwatch.StartNew();
        private static long _lastTick = -1000;
        private static bool _isDown = false;
        private static string _log = @"C:\Users\Administrator\Downloads\shop-bot-2026-main\shop-bot-2026-main\guard_log.txt";

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT { public int x; public int y; }

        [StructLayout(LayoutKind.Sequential)]
        public struct MSG
        {
            public IntPtr hwnd;
            public uint message;
            public IntPtr wParam;
            public IntPtr lParam;
            public uint time;
            public POINT pt;
        }

        [DllImport("user32.dll", SetLastError = true)]
        private static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

        [DllImport("user32.dll")]
        private static extern bool TranslateMessage([In] ref MSG lpMsg);

        [DllImport("user32.dll")]
        private static extern IntPtr DispatchMessage([In] ref MSG lpMsg);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);

        static void Main(string[] args)
        {
            _proc = HookCallback;
            GCHandle.Alloc(_proc); // Pin delegate in memory so GC NEVER collects it

            using (Process curProcess = Process.GetCurrentProcess())
            using (ProcessModule curModule = curProcess.MainModule)
            {
                _hookID = SetWindowsHookEx(WH_KEYBOARD_LL, _proc, GetModuleHandle(curModule.ModuleName), 0);
            }

            File.AppendAllText(_log, string.Format("{0} - Hook installed with ID: {1}\n", DateTime.Now, _hookID));

            MSG msg;
            int ret;
            while ((ret = GetMessage(out msg, IntPtr.Zero, 0, 0)) != 0)
            {
                if (ret == -1)
                {
                    File.AppendAllText(_log, "GetMessage error: " + Marshal.GetLastWin32Error() + "\n");
                    break;
                }
                TranslateMessage(ref msg);
                DispatchMessage(ref msg);
            }

            File.AppendAllText(_log, DateTime.Now + " - Loop exited!\n");
        }

        private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0)
            {
                int vkCode = Marshal.ReadInt32(lParam);
                int msg = wParam.ToInt32();

                if (vkCode == VK_1 || vkCode == VK_NUMPAD1)
                {
                    if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN)
                    {
                        long now = _sw.ElapsedMilliseconds;

                        if (_isDown || (now - _lastTick < MIN_INTERVAL_MS))
                        {
                            // Block the key event
                            return (IntPtr)1;
                        }

                        _isDown = true;
                        _lastTick = now;
                    }
                    else if (msg == WM_KEYUP || msg == WM_SYSKEYUP)
                    {
                        _isDown = false;
                    }
                }
            }
            return CallNextHookEx(_hookID, nCode, wParam, lParam);
        }
    }
}
