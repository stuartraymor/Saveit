# Saveit uninstaller
$ErrorActionPreference = 'SilentlyContinue'
$dest = Join-Path $env:LOCALAPPDATA 'Programs\Saveit'
Write-Host ''
Write-Host '  Remove Saveit' -ForegroundColor Cyan
Write-Host ''
$wipe = $false
if ($args -notcontains '-Keep' -and $args -notcontains '-Quiet') {
  $a = Read-Host '  Also delete your Saveit library and settings? Saved files in Pictures/Videos are never touched. (y/N)'
  $wipe = ($a -match '^[yY]')
}
Get-Process -Name 'Saveit' | Stop-Process -Force
Start-Sleep -Milliseconds 700
Remove-Item (Join-Path ([Environment]::GetFolderPath('Programs')) 'Saveit.lnk') -Force
Remove-Item (Join-Path ([Environment]::GetFolderPath('Programs')) 'Uninstall Saveit.lnk') -Force
Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Saveit.lnk') -Force
Remove-Item 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Saveit' -Recurse -Force
Remove-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'Saveit' -Force
if ($wipe) { Remove-Item (Join-Path $env:APPDATA 'Saveit') -Recurse -Force; Remove-Item (Join-Path $env:APPDATA 'Capture Bench') -Recurse -Force }
# This script lives inside the install folder, so remove the folder after this window closes
if ($args -contains '-Keep') { exit 0 }
Start-Process cmd.exe -ArgumentList "/c timeout /t 2 >nul & rmdir /s /q `"$dest`"" -WindowStyle Hidden
Write-Host '  Saveit was removed.' -ForegroundColor Green
if (-not $wipe) { Write-Host '  Your library and settings were kept, so reinstalling brings everything back.' }
Start-Sleep -Seconds 2
