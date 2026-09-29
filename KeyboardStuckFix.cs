using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace KeyboardDebouncer
{
    public class HiddenForm : Form
    {
        public HiddenForm()
        {
            this.WindowState = FormWindowState.Minimized;
            this.ShowInTaskbar = false;
            this.FormBorderStyle = FormBorderStyle.None;
            this.Size = new Size(0, 0);
        }

        protected override void SetVisibleCore(bool value)
        {
            base.SetVisibleCore(false);
        }
    }

    static class Program
    {
        private const int WH_KEYBOARD_LL = 13;
        private const int WM_KEYDOWN = 0x0100;
        private const int WM_KEYUP = 0x0101;
        private const int WM_SYSKEYDOWN = 0x0104;
        private const int WM_SYSKEYUP = 0x0105;

        private const int VK_1 = 0x31;       // '1' key
        private const int VK_NUMPAD1 = 0x61; // Numpad '1'

        private const long MIN_INTERVAL_MS = 350;

        private static LowLevelKeyboardProc _proc;
        private static IntPtr _hookID = IntPtr.Zero;
        private static readonly Stopwatch _sw = Stopwatch.StartNew();
        private static long _lastTick = -1000;
        private static bool _isDown = false;
        private static string _logFile = @"C:\Users\Administrator\Downloads\shop-bot-2026-main\shop-bot-2026-main\keyboard_fix_log.txt";

        [STAThread]
        static void Main()
        {
            AppDomain.CurrentDomain.UnhandledException += (s, e) => {
                try { File.AppendAllText(_logFile, "Unhandled Exception: " + e.ExceptionObject.ToString() + "\n"); } catch {}
            };

            Application.ThreadException += (s, e) => {
                try { File.AppendAllText(_logFile, "Thread Exception: " + e.Exception.ToString() + "\n"); } catch {}
            };

            _proc = HookCallback;
            GC.KeepAlive(_proc);

            while (true)
            {
                try
                {
                    _hookID = SetHook(_proc);
                    File.AppendAllText(_logFile, DateTime.Now.ToString() + " - Keyboard Guard Started (HookID: " + _hookID + ")\n");
                    Application.Run(new HiddenForm());
                }
                catch (Exception ex)
                {
                    try { File.AppendAllText(_logFile, "Loop error: " + ex.ToString() + "\n"); } catch {}
                    Thread.Sleep(1000);
                }
            }
        }

        private static IntPtr SetHook(LowLevelKeyboardProc proc)
        {
            using (Process curProcess = Process.GetCurrentProcess())
            using (ProcessModule curModule = curProcess.MainModule)
            {
                IntPtr hMod = GetModuleHandle(curModule.ModuleName);
                return SetWindowsHookEx(WH_KEYBOARD_LL, proc, hMod, 0);
            }
        }

        private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

        private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0)
            {
                try
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
                                return (IntPtr)1; // BLOCK THE KEY STROKE
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
                catch {}
            }
            return CallNextHookEx(_hookID, nCode, wParam, lParam);
        }

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);
    }
}
