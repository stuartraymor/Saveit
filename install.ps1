# Saveit installer (per-user, no admin rights needed)
# Downloads the official Electron runtime from GitHub, verifies its SHA-256, then installs the app.
# Run by Install.cmd (text output) or by Saveit-Setup.exe (-FromSetup: prints "##P percent text" progress lines and "##E message" errors instead).
param([switch]$FromSetup)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try { [Net.WebRequest]::DefaultWebProxy.Credentials = [Net.CredentialCache]::DefaultNetworkCredentials } catch {}

function Step($pct, $text) {
  if ($FromSetup) { [Console]::Out.WriteLine("##P $pct $text"); [Console]::Out.Flush() } else { Write-Host "  $text" }
}
function Fail($setupText) {
  if ($FromSetup) { [Console]::Out.WriteLine("##E $setupText"); [Console]::Out.Flush(); exit 1 }
}
trap { if ($FromSetup) { [Console]::Out.WriteLine('##E ' + ($_.Exception.Message -replace '[\r\n]+', ' ')); [Console]::Out.Flush(); exit 1 } else { throw } }

$app     = 'Saveit'
$runtimeUrl  = 'https://github.com/electron/electron/releases/download/v33.2.1/electron-v33.2.1-win32-x64.zip'
$runtimeHash = 'C325A6D905C67107E166267813EA2151AE7FD316C0A88DE0081DB0B9851A9946'
# Test hook (only when SAVEIT_REVIEW_DATA is set): install into a scratch folder instead of the real places
$testRoot = $null
if ($env:SAVEIT_REVIEW_DATA -and $env:SAVEIT_SETUP_TEST_ROOT) { $testRoot = $env:SAVEIT_SETUP_TEST_ROOT }
if ($testRoot) {
  $dest = Join-Path $testRoot 'Programs\Saveit'; $progDir = Join-Path $testRoot 'StartMenu'; $deskDir = Join-Path $testRoot 'Desktop'
  $regBase = 'HKCU:\Software\SaveitSetupTest'
  New-Item -ItemType Directory -Path $progDir, $deskDir -Force | Out-Null
} else {
  $dest = Join-Path $env:LOCALAPPDATA 'Programs\Saveit'; $progDir = [Environment]::GetFolderPath('Programs'); $deskDir = [Environment]::GetFolderPath('Desktop')
  $regBase = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
}
$exe     = Join-Path $dest 'Saveit.exe'
$icon    = Join-Path $dest 'icon.ico'
$startMenu = Join-Path $progDir 'Saveit.lnk'
$desktop   = Join-Path $deskDir 'Saveit.lnk'

if (-not $FromSetup) {
  Write-Host ''
  Write-Host "  Saveit Setup  (version 10.2.5)" -ForegroundColor Cyan
  Write-Host ''
}
if (-not (Test-Path (Join-Path $PSScriptRoot 'app\main.js'))) {
  Fail 'The app files were not found next to the installer.'
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
    if ($FromSetup) {
      try {
        Step 5 'Downloading Saveit components...'
        $req = [Net.HttpWebRequest]::Create($runtimeUrl); $req.UserAgent = 'SaveitSetup'; $req.Timeout = 30000; $req.ReadWriteTimeout = 30000
        $resp = $req.GetResponse(); $total = $resp.ContentLength; $inS = $resp.GetResponseStream(); $part = "$zip.part"
        $outS = [IO.File]::Create($part); $buf = New-Object byte[] 262144; $got = 0L; $last = -1
        while (($n = $inS.Read($buf, 0, $buf.Length)) -gt 0) {
          $outS.Write($buf, 0, $n); $got += $n
          if ($total -gt 0) { $p = [int](5 + 65 * $got / $total); if ($p -ne $last) { $last = $p; Step $p ('Downloading Saveit components... {0} of {1} MB' -f [int]($got / 1MB), [int]($total / 1MB)) } }
        }
        $outS.Close(); $inS.Close(); $resp.Close()
        Move-Item $part $zip -Force
      } catch {
        Fail 'The download did not finish. Check your internet connection and run Setup again. If a firewall or antivirus blocks it, use the zip version from the Saveit page on GitHub.'
      }
    } else {
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
}
Step 72 'Checking the download...'
if ((Get-FileHash $zip -Algorithm SHA256).Hash -ne $runtimeHash) {
  Remove-Item $zip -Force -ErrorAction SilentlyContinue
  Fail 'The downloaded file did not match its expected fingerprint, so Setup stopped to keep your computer safe. Run Setup again.'
  Write-Host '  The runtime file did not match the expected fingerprint, so setup stopped. Run Install.cmd again.' -ForegroundColor Yellow
  exit 1
}

# 2. Install
Step 76 'Installing...'
if ($testRoot) {
  Get-Process -Name 'Saveit' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe } | Stop-Process -Force
} else {
  Get-Process -Name 'Saveit','Capture Bench' -ErrorAction SilentlyContinue | Stop-Process -Force
  # Remove the earlier version (Capture Bench). Saved captures are kept.
  $old = Join-Path $env:LOCALAPPDATA 'Programs\Capture Bench'
  if (Test-Path $old) { Remove-Item $old -Recurse -Force -ErrorAction SilentlyContinue }
  Remove-Item (Join-Path ([Environment]::GetFolderPath('Programs')) 'Capture Bench.lnk') -Force -ErrorAction SilentlyContinue
  Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Capture Bench.lnk') -Force -ErrorAction SilentlyContinue
  Remove-Item 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CaptureBench' -Recurse -Force -ErrorAction SilentlyContinue
  Remove-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'CaptureBench' -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 500
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Step 80 'Unpacking Saveit...'
if ($FromSetup) { Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::ExtractToDirectory($zip, $dest) }
else { Expand-Archive -Path $zip -DestinationPath $dest -Force }
Remove-Item (Join-Path $dest 'resources\default_app.asar') -Force -ErrorAction SilentlyContinue
Rename-Item (Join-Path $dest 'electron.exe') 'Saveit.exe'
Get-ChildItem (Join-Path $dest 'locales') -Exclude 'en-US.pak' | Remove-Item -Force -ErrorAction SilentlyContinue
Step 90 'Adding Saveit...'
$appDir = Join-Path $dest 'resources\app'
New-Item -ItemType Directory -Path $appDir -Force | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'app\*') $appDir -Recurse -Force
Copy-Item (Join-Path $PSScriptRoot 'app\icon.ico') $icon -Force
Copy-Item (Join-Path $PSScriptRoot 'uninstall.ps1') $dest -Force
Copy-Item (Join-Path $PSScriptRoot 'Uninstall.cmd') $dest -Force
Copy-Item (Join-Path $PSScriptRoot 'Reinstall.cmd') $dest -Force

# 3. Shortcuts
Step 95 'Adding shortcuts...'
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
$uns = $sh.CreateShortcut((Join-Path $progDir 'Uninstall Saveit.lnk'))
$uns.TargetPath = (Join-Path $dest 'Uninstall.cmd'); $uns.WorkingDirectory = $dest; $uns.IconLocation = "$icon,0"; $uns.Description = 'Remove Saveit'; $uns.Save()

# 4. Show in Settings > Apps so it can be uninstalled normally
Step 98 'Finishing...'
$key = "$regBase\Saveit"
New-Item -Path $key -Force | Out-Null
Set-ItemProperty $key DisplayName $app
Set-ItemProperty $key DisplayVersion '10.2.5'
Set-ItemProperty $key Publisher 'Saveit'
Set-ItemProperty $key DisplayIcon $icon
Set-ItemProperty $key InstallLocation $dest
Set-ItemProperty $key UninstallString "`"$dest\Uninstall.cmd`""
Set-ItemProperty $key NoModify 1 -Type DWord
Set-ItemProperty $key NoRepair 1 -Type DWord
$size = [int]((Get-ChildItem $dest -Recurse | Measure-Object Length -Sum).Sum / 1KB)
Set-ItemProperty $key EstimatedSize $size -Type DWord

if ($FromSetup) { Step 100 'Done'; exit 0 }
Write-Host ''
Write-Host "  Done. Installed to $dest" -ForegroundColor Green
Write-Host '  Shortcuts were added to the Start menu and desktop. Your library and settings were kept.'
Start-Process $exe
