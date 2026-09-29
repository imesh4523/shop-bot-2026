using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace AntiOneSpamGuard
{
    public class Program
    {
        private const int WH_KEYBOARD_LL = 13;
        private const int WM_KEYDOWN = 0x0100;
        private const int WM_KEYUP = 0x0101;
        private const int WM_SYSKEYDOWN = 0x0104;
        private const int WM_SYSKEYUP = 0x0105;

        private const int VK_1 = 0x31;       // Top-row '1' / '!'
        private const int VK_NUMPAD1 = 0x61; // Numpad '1'

        private const long MIN_COOLDOWN_MS = 400;
        private const long REQUIRED_SILENCE_MS = 250;

        private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
        private static LowLevelKeyboardProc _proc;
        private static IntPtr _hookID = IntPtr.Zero;
        private static GCHandle _procHandle;

        private static readonly Stopwatch _timer = Stopwatch.StartNew();
        private static long _lastAllowedTime = -10000;
        private static long _lastAnyEventTime = -10000;
        public static long BlockedCount = 0;

        public static bool IsProtectionActive = true;
        public static bool StrictMuteMode = false;

        private static NotifyIcon _notifyIcon;
        private static ContextMenuStrip _contextMenu;
        private static ToolStripMenuItem _statusItem;
        private static ToolStripMenuItem _blockedCountItem;
        private static ToolStripMenuItem _strictMuteItem;
        private static ToolStripMenuItem _startupItem;

        private const string RUN_KEY = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string APP_NAME = "AntiOneSpamGuard";
        private static string _log = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "KeyboardGuard", "guard.log");

        private static void Log(string msg)
        {
            try { 
                string dir = Path.GetDirectoryName(_log);
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                File.AppendAllText(_log, DateTime.Now.ToString("HH:mm:ss.fff") + " - " + msg + Environment.NewLine); 
            } catch {}
        }

        [STAThread]
        public static void Main()
        {
            Log("Main starting...");
            try
            {
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                EnsureStartupRegistered();
                Log("Startup checked.");

                SetupTray();
                Log("Tray setup done.");

                InstallHook();
                Log("Hook installed: " + _hookID);

                System.Windows.Forms.Timer watchdog = new System.Windows.Forms.Timer();
                watchdog.Interval = 10000;
                watchdog.Tick += (s, e) => {
                    UpdateTrayText();
                    if (_hookID == IntPtr.Zero && IsProtectionActive)
                    {
                        InstallHook();
                        Log("Watchdog reinstalled hook.");
                    }
                };
                watchdog.Start();

                Log("Starting message loop with ApplicationContext...");
                Application.Run(new ApplicationContext());
                Log("Message loop finished.");
            }
            catch (Exception ex)
            {
                Log("EXCEPTION: " + ex.ToString());
            }
            finally
            {
                UninstallHook();
                Log("Hook uninstalled. Exiting.");
            }
        }

        private static void InstallHook()
        {
            try
            {
                UninstallHook();
                _proc = HookCallback;
                _procHandle = GCHandle.Alloc(_proc);

                using (Process curProcess = Process.GetCurrentProcess())
                using (ProcessModule curModule = curProcess.MainModule)
                {
                    _hookID = SetWindowsHookEx(WH_KEYBOARD_LL, _proc, GetModuleHandle(curModule.ModuleName), 0);
                }
            }
            catch (Exception ex)
            {
                Log("InstallHook ex: " + ex.Message);
            }
        }

        private static void UninstallHook()
        {
            try
            {
                if (_hookID != IntPtr.Zero)
                {
                    UnhookWindowsHookEx(_hookID);
                    _hookID = IntPtr.Zero;
                }
                if (_procHandle.IsAllocated)
                {
                    _procHandle.Free();
                }
            }
            catch {}
        }

        private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0 && IsProtectionActive)
            {
                int msg = wParam.ToInt32();
                if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN)
                {
                    int vkCode = Marshal.ReadInt32(lParam);

                    if (vkCode == VK_1 || vkCode == VK_NUMPAD1)
                    {
                        if (StrictMuteMode)
                        {
                            Interlocked.Increment(ref BlockedCount);
                            return (IntPtr)1;
                        }

                        long now = _timer.ElapsedMilliseconds;
                        long timeSinceAllowed = now - _lastAllowedTime;
                        long timeSinceLastEvent = now - _lastAnyEventTime;

                        _lastAnyEventTime = now;

                        if (timeSinceAllowed >= MIN_COOLDOWN_MS && timeSinceLastEvent >= REQUIRED_SILENCE_MS)
                        {
                            _lastAllowedTime = now;
                            return CallNextHookEx(_hookID, nCode, wParam, lParam);
                        }
                        else
                        {
                            Interlocked.Increment(ref BlockedCount);
                            return (IntPtr)1;
                        }
                    }
                }
            }

            return CallNextHookEx(_hookID, nCode, wParam, lParam);
        }

        private static void SetupTray()
        {
            _contextMenu = new ContextMenuStrip();

            _statusItem = new ToolStripMenuItem("??? Protection: ACTIVE (Click to Pause)", null, (s, e) => {
                IsProtectionActive = !IsProtectionActive;
                UpdateTrayStatus();
            });
            _statusItem.Font = new Font(_contextMenu.Font, FontStyle.Bold);

            _blockedCountItem = new ToolStripMenuItem("?? Spams Blocked: 0");
            _blockedCountItem.Enabled = false;

            _strictMuteItem = new ToolStripMenuItem("?? Complete '1' Mute Mode", null, (s, e) => {
                StrictMuteMode = !StrictMuteMode;
                _strictMuteItem.Checked = StrictMuteMode;
                _notifyIcon.ShowBalloonTip(2000, "Mode Changed",
                    StrictMuteMode ? "Complete 1 Mute ON: All '1' key presses are now blocked." : "Smart Anti-Repeat ON: Single tap allowed, repeats blocked.",
                    ToolTipIcon.Info);
            });
            _strictMuteItem.Checked = false;

            _startupItem = new ToolStripMenuItem("?? Run on Windows Startup", null, (s, e) => {
                ToggleStartup();
            });
            _startupItem.Checked = IsStartupEnabled();

            ToolStripMenuItem testItem = new ToolStripMenuItem("?? Test Protection (Open Notepad)", null, (s, e) => {
                Process.Start("notepad.exe");
            });

            ToolStripSeparator sep1 = new ToolStripSeparator();
            ToolStripSeparator sep2 = new ToolStripSeparator();

            ToolStripMenuItem exitItem = new ToolStripMenuItem("? Exit", null, (s, e) => {
                Application.Exit();
            });

            _contextMenu.Items.Add(_statusItem);
            _contextMenu.Items.Add(_blockedCountItem);
            _contextMenu.Items.Add(sep1);
            _contextMenu.Items.Add(_strictMuteItem);
            _contextMenu.Items.Add(_startupItem);
            _contextMenu.Items.Add(testItem);
            _contextMenu.Items.Add(sep2);
            _contextMenu.Items.Add(exitItem);

            _notifyIcon = new NotifyIcon
            {
                Icon = CreateShieldIcon(true),
                Text = "Anti-1 Spam Guard: Active",
                ContextMenuStrip = _contextMenu,
                Visible = true
            };

            _notifyIcon.DoubleClick += (s, e) => {
                IsProtectionActive = !IsProtectionActive;
                UpdateTrayStatus();
            };
        }

        private static void UpdateTrayStatus()
        {
            if (IsProtectionActive)
            {
                _statusItem.Text = "??? Protection: ACTIVE (Click to Pause)";
                _statusItem.ForeColor = Color.DarkGreen;
                _notifyIcon.Icon = CreateShieldIcon(true);
                _notifyIcon.Text = string.Format("Anti-1 Guard: Active | Blocked: {0}", BlockedCount);
                if (_hookID == IntPtr.Zero) InstallHook();
            }
            else
            {
                _statusItem.Text = "?? Protection: PAUSED (Click to Resume)";
                _statusItem.ForeColor = Color.DarkRed;
                _notifyIcon.Icon = CreateShieldIcon(false);
                _notifyIcon.Text = "Anti-1 Guard: PAUSED";
            }
        }

        private static void UpdateTrayText()
        {
            if (_blockedCountItem != null)
            {
                _blockedCountItem.Text = string.Format("?? Spams Blocked: {0}", BlockedCount);
            }
            if (_notifyIcon != null && IsProtectionActive)
            {
                _notifyIcon.Text = string.Format("Anti-1 Guard: Active | Blocked: {0}", BlockedCount);
            }
        }

        private static Icon CreateShieldIcon(bool active)
        {
            using (Bitmap bmp = new Bitmap(16, 16))
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.Clear(Color.Transparent);
                g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;

                Color bg = active ? Color.FromArgb(46, 125, 50) : Color.FromArgb(198, 40, 40);
                using (Brush brush = new SolidBrush(bg))
                {
                    Point[] pts = new Point[] {
                        new Point(8, 1),
                        new Point(14, 3),
                        new Point(14, 9),
                        new Point(8, 15),
                        new Point(2, 9),
                        new Point(2, 3)
                    };
                    g.FillPolygon(brush, pts);
                }

                using (Brush textBrush = new SolidBrush(Color.White))
                using (Font font = new Font("Arial", 8, FontStyle.Bold, GraphicsUnit.Pixel))
                {
                    StringFormat sf = new StringFormat
                    {
                        Alignment = StringAlignment.Center,
                        LineAlignment = StringAlignment.Center
                    };
                    g.DrawString("1", font, textBrush, new RectangleF(0, 1, 16, 13), sf);
                }

                IntPtr hIcon = bmp.GetHicon();
                return Icon.FromHandle(hIcon);
            }
        }

        private static bool IsStartupEnabled()
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RUN_KEY, false))
                {
                    return key != null && key.GetValue(APP_NAME) != null;
                }
            }
            catch { return false; }
        }

        private static void EnsureStartupRegistered()
        {
            try
            {
                string exePath = Assembly.GetExecutingAssembly().Location;
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RUN_KEY, true))
                {
                    if (key != null)
                    {
                        key.SetValue(APP_NAME, "\"" + exePath + "\"");
                    }
                }
            }
            catch {}
        }

        private static void ToggleStartup()
        {
            try
            {
                string exePath = Assembly.GetExecutingAssembly().Location;
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RUN_KEY, true))
                {
                    if (key != null)
                    {
                        if (IsStartupEnabled())
                        {
                            key.DeleteValue(APP_NAME, false);
                            _startupItem.Checked = false;
                        }
                        else
                        {
                            key.SetValue(APP_NAME, "\"" + exePath + "\"");
                            _startupItem.Checked = true;
                        }
                    }
                }
            }
            catch {}
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
