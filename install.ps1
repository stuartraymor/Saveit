# Saveit installer (per-user, no admin rights needed)
# Downloads the official Electron runtime from GitHub, verifies its SHA-256, then installs the app.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try { [Net.WebRequest]::DefaultWebProxy.Credentials = [Net.CredentialCache]::DefaultNetworkCredentials } catch {}

$app     = 'Saveit'
$runtimeUrl  = 'https://github.com/electron/electron/releases/download/v33.2.1/electron-v33.2.1-win32-x64.zip'
$runtimeHash = 'C325A6D905C67107E166267813EA2151AE7FD316C0A88DE0081DB0B9851A9946'
$dest    = Join-Path $env:LOCALAPPDATA 'Programs\Saveit'
$exe     = Join-Path $dest 'Saveit.exe'
$icon    = Join-Path $dest 'icon.ico'
$startMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Saveit.lnk'
$desktop   = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Saveit.lnk'

Write-Host ''
Write-Host "  Saveit Setup  (version 10.0.0)" -ForegroundColor Cyan
Write-Host ''
if (-not (Test-Path (Join-Path $PSScriptRoot 'app\main.js'))) {
  Write-Host '  The app files were not found next to this script.' -ForegroundColor Yellow
  Write-Host '  Right-click the zip, choose Extract All, then run Install.cmd from the extracted folder.'
  exit 1
}

# 1. Runtime: use electron.zip next to this script if present, otherwise download it
$zip = Join-Path $PSScriptRoot 'electron.zip'
if (-not (Test-Path $zip)) {
  $zip = Join-Path $env:TEMP 'capture-bench-runtime.zip'
  $ok = (Test-Path $zip) -and ((Get-FileHash $zip -Algorithm SHA256).Hash -eq $runtimeHash)
  if (-not $ok) {
    Write-Host '  Downloading the app runtime (about 110 MB, one time)...'
    try { Invoke-WebRequest -Uri $runtimeUrl -OutFile $zip -UseBasicParsing }
    catch {
      Write-Host ''
      Write-Host '  The download was blocked or failed.' -ForegroundColor Yellow
      Write-Host "  Download this file in your browser:"
      Write-Host "    $runtimeUrl"
      Write-Host "  Rename it to electron.zip, put it in this folder next to Install.cmd, and run Install.cmd again."
      exit 1
    }
  }
}
Write-Host '  Checking the download...'
if ((Get-FileHash $zip -Algorithm SHA256).Hash -ne $runtimeHash) {
  Remove-Item $zip -Force -ErrorAction SilentlyContinue
  Write-Host '  The runtime file did not match the expected fingerprint, so setup stopped. Run Install.cmd again.' -ForegroundColor Yellow
  exit 1
}

# 2. Install
Write-Host '  Installing...'
Get-Process -Name 'Saveit','Capture Bench' -ErrorAction SilentlyContinue | Stop-Process -Force
# Remove the earlier version (Capture Bench). Saved captures are kept.
$old = Join-Path $env:LOCALAPPDATA 'Programs\Capture Bench'
if (Test-Path $old) { Remove-Item $old -Recurse -Force -ErrorAction SilentlyContinue }
Remove-Item (Join-Path ([Environment]::GetFolderPath('Programs')) 'Capture Bench.lnk') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Capture Bench.lnk') -Force -ErrorAction SilentlyContinue
Remove-Item 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CaptureBench' -Recurse -Force -ErrorAction SilentlyContinue
Remove-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'CaptureBench' -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Expand-Archive -Path $zip -DestinationPath $dest -Force
Remove-Item (Join-Path $dest 'resources\default_app.asar') -Force -ErrorAction SilentlyContinue
Rename-Item (Join-Path $dest 'electron.exe') 'Saveit.exe'
Get-ChildItem (Join-Path $dest 'locales') -Exclude 'en-US.pak' | Remove-Item -Force -ErrorAction SilentlyContinue
$appDir = Join-Path $dest 'resources\app'
New-Item -ItemType Directory -Path $appDir -Force | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'app\*') $appDir -Recurse -Force
Copy-Item (Join-Path $PSScriptRoot 'app\icon.ico') $icon -Force
Copy-Item (Join-Path $PSScriptRoot 'uninstall.ps1') $dest -Force
Copy-Item (Join-Path $PSScriptRoot 'Uninstall.cmd') $dest -Force
Copy-Item (Join-Path $PSScriptRoot 'Reinstall.cmd') $dest -Force

# 3. Shortcuts
$sh = New-Object -ComObject WScript.Shell
foreach ($lnk in @($startMenu, $desktop)) {
  $s = $sh.CreateShortcut($lnk)
  $s.TargetPath = $exe
  $s.WorkingDirectory = $dest
  $s.IconLocation = "$icon,0"
  $s.Description = 'Screen capture, recording and markup'
  $s.Save()
}

# Start menu: an Uninstall shortcut too
$uns = $sh.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Programs')) 'Uninstall Saveit.lnk'))
$uns.TargetPath = (Join-Path $dest 'Uninstall.cmd'); $uns.WorkingDirectory = $dest; $uns.IconLocation = "$icon,0"; $uns.Description = 'Remove Saveit'; $uns.Save()

# 4. Show in Settings > Apps so it can be uninstalled normally
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Saveit'
New-Item -Path $key -Force | Out-Null
Set-ItemProperty $key DisplayName $app
Set-ItemProperty $key DisplayVersion '10.0.0'
Set-ItemProperty $key Publisher 'Saveit'
Set-ItemProperty $key DisplayIcon $icon
Set-ItemProperty $key InstallLocation $dest
Set-ItemProperty $key UninstallString "`"$dest\Uninstall.cmd`""
Set-ItemProperty $key NoModify 1 -Type DWord
Set-ItemProperty $key NoRepair 1 -Type DWord
$size = [int]((Get-ChildItem $dest -Recurse | Measure-Object Length -Sum).Sum / 1KB)
Set-ItemProperty $key EstimatedSize $size -Type DWord

Write-Host ''
Write-Host "  Done. Installed to $dest" -ForegroundColor Green
Write-Host '  Shortcuts were added to the Start menu and desktop. Your library and settings were kept.'
Start-Process $exe
