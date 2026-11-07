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
        private const int VK_Q = 0x51;       // 'Q' key
        private const int VK_BACK = 0x08;    // Backspace

        private const uint KEYEVENTF_KEYUP = 0x0002;
        private static readonly UIntPtr SYNTHETIC_EXTRA_INFO = (UIntPtr)0x9999;

        private static LowLevelKeyboardProc _proc;
        private static IntPtr _hookID = IntPtr.Zero;
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
            GCHandle.Alloc(_proc);

            while (true)
            {
                try
                {
                    _hookID = SetHook(_proc);
                    File.AppendAllText(_logFile, DateTime.Now.ToString() + " - Zero-Leak Combo Guard Started (HookID: " + _hookID + ")\n");
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
                    // Check if this event was synthesized by our tool
                    IntPtr extraInfo = Marshal.ReadIntPtr(lParam, 16);
                    if (extraInfo == (IntPtr)0x9999)
                    {
                        return CallNextHookEx(_hookID, nCode, wParam, lParam);
                    }

                    int vkCode = Marshal.ReadInt32(lParam, 0);
                    int msg = wParam.ToInt32();

                    if (vkCode == VK_1 || vkCode == VK_NUMPAD1)
                    {
                        bool isQDown = (GetAsyncKeyState(VK_Q) & 0x8000) != 0;

                        // ONLY if Q is held down (1 + Q combination):
                        if (isQDown)
                        {
                            if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN)
                            {
                                ThreadPool.QueueUserWorkItem(_ => {
                                    Thread.Sleep(10);
                                    // Erase any 'q' typed, then send '1'
                                    keybd_event((byte)VK_BACK, 0, 0, SYNTHETIC_EXTRA_INFO);
                                    keybd_event((byte)VK_BACK, 0, KEYEVENTF_KEYUP, SYNTHETIC_EXTRA_INFO);
                                    keybd_event((byte)VK_1, 0, 0, SYNTHETIC_EXTRA_INFO);
                                    keybd_event((byte)VK_1, 0, KEYEVENTF_KEYUP, SYNTHETIC_EXTRA_INFO);
                                });
                            }
                            return (IntPtr)1; // Block the raw stuck '1'
                        }

                        // UNDER ALL OTHER CIRCUMSTANCES: 1 IS 100% COMPLETELY BLOCKED!
                        return (IntPtr)1;
                    }
                }
                catch {}
            }
            return CallNextHookEx(_hookID, nCode, wParam, lParam);
        }

        [DllImport("user32.dll")]
        private static extern short GetAsyncKeyState(int vKey);

        [DllImport("user32.dll")]
        private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

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
