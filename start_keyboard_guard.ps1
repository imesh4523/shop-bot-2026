$targetDir = "$env:LOCALAPPDATA\KeyboardGuard"
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

Copy-Item "KeyboardStuckFix.exe" "$targetDir\KeyboardStuckFix.exe" -Force
Copy-Item "KeyboardStuckFix.exe" "$targetDir\AntiOneSpamGuard.exe" -Force
Copy-Item "KeyboardStuckFix.exe" "AntiOneSpamGuard.exe" -Force

Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "KeyboardStuckFix" -Value "`"$targetDir\KeyboardStuckFix.exe`""
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "AntiOneSpamGuard" -Value "`"$targetDir\AntiOneSpamGuard.exe`""

Stop-Process -Name "KeyboardStuckFix" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "AntiOneSpamGuard" -Force -ErrorAction SilentlyContinue

# Launch detached via wscript
wscript.exe "launch_guard.vbs"
Start-Sleep -Seconds 1

$p = Get-Process -Name "KeyboardStuckFix" -ErrorAction SilentlyContinue
if ($p) {
    Write-Host "SUCCESS: Keyboard Guard is active (PID: $($p.Id))"
} else {
    Write-Host "FAILED: Process not found"
}
