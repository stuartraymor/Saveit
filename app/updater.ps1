# Saveit updater (10.2.0). Started by Saveit itself, after the person chose Install Update and confirmed.
# This script is Saveit's own (copied from the installed app); it never runs anything that came from the download.
# What it does, in order:
#   1. waits for Saveit to close on its own. It NEVER closes or kills Saveit. If Saveit is still open after the wait, nothing is changed.
#   2. backs up the installed app (and verifies the backup),
#   3. copies the verified new app files next to it, checks them, then swaps them in (the runtime, shortcuts, library and settings are not touched),
#   4. starts the new version and waits for it to report that it is running,
#   5. if the new version does not start properly, puts the previous version back and starts that instead.
# The result is written to ResultFile; the next start of Saveit shows it. Everything is logged to LogFile.
param(
  [Parameter(Mandatory)][string]$StageRoot,
  [Parameter(Mandatory)][string]$InstallDir,
  [Parameter(Mandatory)][int]$ParentPid,
  [Parameter(Mandatory)][string]$NewVersion,
  [Parameter(Mandatory)][string]$OldVersion,
  [Parameter(Mandatory)][string]$ResultFile,
  [Parameter(Mandatory)][string]$HealthFile,
  [Parameter(Mandatory)][string]$LogFile,
  [string]$CancelFile = '',
  [int]$WaitSeconds = 180,
  [int]$HealthSeconds = 45
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Log([string]$m) { try { Add-Content -Path $LogFile -Value ('{0:yyyy-MM-dd HH:mm:ss} {1}' -f (Get-Date), $m) } catch { } }
# Progress for the "Updating Saveit" window (saveit-updating.exe reads these lines; harmless when nothing does)
function Progress([int]$pct, [string]$text) { try { [Console]::Out.WriteLine("##P $pct $text"); [Console]::Out.Flush() } catch { } }
function Problem([string]$text) { try { [Console]::Out.WriteLine("##E $text"); [Console]::Out.Flush() } catch { } }
function Write-Result([string]$status, [string]$message, [string]$installed) {
  $o = [ordered]@{ status = $status; message = $message; version = $installed; attempted = $NewVersion; previous = $OldVersion; log = $LogFile; at = (Get-Date).ToString('o') }
  try { New-Item -ItemType Directory -Path (Split-Path $ResultFile -Parent) -Force | Out-Null; ($o | ConvertTo-Json) | Set-Content -Path $ResultFile -Encoding UTF8 } catch { Log "could not write the result file: $_" }
  Log "result: $status - $message"
}

New-Item -ItemType Directory -Path (Split-Path $LogFile -Parent) -Force | Out-Null
Log "=== update $OldVersion -> $NewVersion (parent pid $ParentPid) ==="

$exePath = Join-Path $InstallDir 'Saveit.exe'
$appCur  = Join-Path $InstallDir 'resources\app'
$appNew  = Join-Path $StageRoot 'app'
$appTmp  = Join-Path $InstallDir 'resources\app.new'
$appOld  = Join-Path $InstallDir 'resources\app.old'
$appBad  = Join-Path $InstallDir 'resources\app.failed'
$backup  = Join-Path $InstallDir 'update-backup'
$support = @('uninstall.ps1', 'Uninstall.cmd', 'Reinstall.cmd')
$regKey  = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Saveit'
$swapped = $false

function Saveit-Processes {
  # every running program that lives in the install folder (Saveit itself, its helper)
  $found = @()
  foreach ($p in (Get-Process -ErrorAction SilentlyContinue)) {
    try { if ($p.Path -and $p.Path.StartsWith($InstallDir, [System.StringComparison]::OrdinalIgnoreCase)) { $found += $p } } catch { }
  }
  return $found
}
function Tree-Differences([string]$a, [string]$b) {
  # number of files under $a that are missing from $b or different in $b
  $n = 0; $root = (Resolve-Path $a).Path.TrimEnd('\')
  foreach ($f in Get-ChildItem -LiteralPath $a -Recurse -File -Force) {
    $rel = $f.FullName.Substring($root.Length + 1); $other = Join-Path $b $rel
    if (-not (Test-Path -LiteralPath $other -PathType Leaf)) { $n++; continue }
    if ((Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $other -Algorithm SHA256).Hash) { $n++ }
  }
  return $n
}
function Rename-Retry([string]$path, [string]$newName) {
  for ($i = 0; $i -lt 12; $i++) { try { Rename-Item -LiteralPath $path -NewName $newName -ErrorAction Stop; return } catch { Start-Sleep -Milliseconds 500 } }
  Rename-Item -LiteralPath $path -NewName $newName -ErrorAction Stop
}
function Set-RegVersion([string]$v) {
  # only the Settings > Apps entry that belongs to THIS install folder (a copy of Saveit somewhere else must not change it)
  try {
    if (Test-Path $regKey) {
      $loc = (Get-ItemProperty $regKey -ErrorAction Stop).InstallLocation
      if ($loc -and ($loc.TrimEnd('\') -ieq $InstallDir.TrimEnd('\'))) { Set-ItemProperty $regKey DisplayVersion $v } else { Log 'registry entry belongs to another install; left alone' }
    }
  } catch { Log "registry version not updated: $_" }
}
function Start-Saveit([bool]$withHealth) {
  if ($withHealth) { $env:SAVEIT_UPDATE_HEALTH = $HealthFile } else { Remove-Item Env:SAVEIT_UPDATE_HEALTH -ErrorAction SilentlyContinue }
  try { return Start-Process -FilePath $exePath -WorkingDirectory $InstallDir -PassThru } finally { Remove-Item Env:SAVEIT_UPDATE_HEALTH -ErrorAction SilentlyContinue }
}
function Restore-Previous {
  # put the previous version back (from the quick rename if it is still there, otherwise from the verified backup)
  Log 'restoring the previous version'
  if (Test-Path $appCur) { if (Test-Path $appBad) { Remove-Item $appBad -Recurse -Force -ErrorAction SilentlyContinue }; Rename-Retry $appCur 'app.failed' }
  if (Test-Path $appOld) { Rename-Retry $appOld 'app' }
  elseif (Test-Path (Join-Path $backup 'app')) { Copy-Item (Join-Path $backup 'app') $appCur -Recurse -Force }
  else { throw 'The previous version could not be found to restore.' }
  foreach ($f in $support) { $b = Join-Path $backup $f; if (Test-Path $b) { Copy-Item $b (Join-Path $InstallDir $f) -Force -ErrorAction SilentlyContinue } }
  $bi = Join-Path $backup 'icon.ico'; if (Test-Path $bi) { Copy-Item $bi (Join-Path $InstallDir 'icon.ico') -Force -ErrorAction SilentlyContinue }
  Set-RegVersion $OldVersion
}
function Stop-NewInstance {
  # Only used on the copy this script itself just started and that never reported healthy: ask it to close, then end it.
  foreach ($p in Saveit-Processes) { try { [void]$p.CloseMainWindow() } catch { } }
  $end = (Get-Date).AddSeconds(6); while ((Saveit-Processes).Count -gt 0 -and (Get-Date) -lt $end) { Start-Sleep -Milliseconds 300 }
  foreach ($p in Saveit-Processes) { try { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } catch { } }
  Start-Sleep -Milliseconds 800
}

try {
  # ---- checks before anything is touched ----
  if ($NewVersion -notmatch '^\d{1,4}\.\d{1,4}\.\d{1,4}$' -or $OldVersion -notmatch '^\d{1,4}\.\d{1,4}\.\d{1,4}$') { throw 'The version numbers were not valid.' }
  if (-not (Test-Path $exePath) -or -not (Test-Path (Join-Path $appCur 'main.js'))) { throw 'The installed copy of Saveit was not found in the expected place.' }
  foreach ($f in @('main.js', 'preload.js', 'index.html', 'package.json')) { if (-not (Test-Path (Join-Path $appNew $f))) { throw "The update package is missing $f." } }
  $pk = Get-Content -LiteralPath (Join-Path $appNew 'package.json') -Raw | ConvertFrom-Json
  if ($pk.version -ne $NewVersion) { throw "The update package is version $($pk.version), not $NewVersion." }

  # ---- 1. wait for Saveit to close by itself (never forced) ----
  Log 'waiting for Saveit to close'
  Progress 3 'Waiting for Saveit to close...'
  $deadline = (Get-Date).AddSeconds($WaitSeconds)
  while ((Saveit-Processes).Count -gt 0 -and (Get-Date) -lt $deadline) {
    # Saveit asks for a cancel when it did not close; nothing has been changed at this point
    if ($CancelFile -and (Test-Path $CancelFile)) { Remove-Item $CancelFile -Force -ErrorAction SilentlyContinue; Log 'cancelled before anything was changed'; exit 0 }
    Start-Sleep -Milliseconds 300
  }
  if ((Saveit-Processes).Count -gt 0) {
    Write-Result 'unchanged' 'Saveit did not close in time, so nothing was changed. Close Saveit yourself and try the update again.' $OldVersion
    exit 0
  }
  Log 'Saveit has closed'
  Progress 15 'Backing up your current version...'

  # ---- 2. back up the installed version and check the backup ----
  if (Test-Path $backup) { Remove-Item $backup -Recurse -Force }
  New-Item -ItemType Directory -Path $backup -Force | Out-Null
  Copy-Item -LiteralPath $appCur -Destination (Join-Path $backup 'app') -Recurse -Force
  foreach ($f in ($support + @('icon.ico'))) { $s = Join-Path $InstallDir $f; if (Test-Path $s) { Copy-Item $s (Join-Path $backup $f) -Force } }
  Set-Content -Path (Join-Path $backup 'version.txt') -Value $OldVersion
  if ((Tree-Differences $appCur (Join-Path $backup 'app')) -ne 0) { throw 'The backup of the current version could not be verified.' }
  Log 'backup verified'
  Progress 35 'Installing the new version...'

  # ---- 3. copy the new app next to the old one, check it, then swap ----
  foreach ($d in @($appTmp, $appOld, $appBad)) { if (Test-Path $d) { Remove-Item $d -Recurse -Force } }
  Copy-Item -LiteralPath $appNew -Destination $appTmp -Recurse -Force
  if ((Tree-Differences $appNew $appTmp) -ne 0) { throw 'The new files were not copied correctly.' }
  Rename-Retry $appCur 'app.old'
  try { Rename-Retry $appTmp 'app' } catch { Rename-Item -LiteralPath $appOld -NewName 'app' -ErrorAction SilentlyContinue; throw }
  $swapped = $true
  Log 'new app in place'
  Progress 65 'Checking the new version...'
  foreach ($f in $support) { $s = Join-Path $StageRoot $f; if (Test-Path $s) { Copy-Item $s (Join-Path $InstallDir $f) -Force } }
  $ni = Join-Path $appNew 'icon.ico'; if (Test-Path $ni) { Copy-Item $ni (Join-Path $InstallDir 'icon.ico') -Force }
  Set-RegVersion $NewVersion

  # ---- 4. start the new version and wait for it to say it is running ----
  Remove-Item $HealthFile -Force -ErrorAction SilentlyContinue
  Progress 75 "Starting Saveit $NewVersion..."
  $proc = Start-Saveit $true
  Log "started the new version (pid $($proc.Id))"
  $healthy = $false; $end = (Get-Date).AddSeconds($HealthSeconds); $lastPp = 0
  while ((Get-Date) -lt $end) {
    if (Test-Path $HealthFile) { try { $h = Get-Content -LiteralPath $HealthFile -Raw | ConvertFrom-Json; if ($h.version -eq $NewVersion) { $healthy = $true; break } } catch { } }
    if ($proc.HasExited) { break }
    Start-Sleep -Milliseconds 400
    $pp = [int][Math]::Min(97, 75 + 22 * ((Get-Date) - $end.AddSeconds(-$HealthSeconds)).TotalSeconds / [Math]::Max(1, $HealthSeconds)); if ($pp -ne $lastPp) { $lastPp = $pp; Progress $pp "Starting Saveit $NewVersion..." }
  }
  if ($healthy) {
    Remove-Item $appOld -Recurse -Force -ErrorAction SilentlyContinue
    # the downloaded package is no longer needed (the backup of the previous version stays until the next update)
    try {
      $extracted = Split-Path $StageRoot -Parent; $stageDir = Split-Path $extracted -Parent
      Remove-Item $extracted -Recurse -Force -ErrorAction SilentlyContinue
      Remove-Item (Join-Path $stageDir "Saveit-$NewVersion.zip") -Force -ErrorAction SilentlyContinue
    } catch { }
    Write-Result 'ok' "Saveit was updated to version $NewVersion and is running." $NewVersion
    Progress 100 'Done'
    exit 0
  }
  throw 'The new version did not start properly.'
}
catch {
  $why = $_.Exception.Message
  Log "FAILED: $why"
  Progress 85 'Something went wrong. Putting your previous version back...'
  $installed = $OldVersion
  try {
    if ($swapped) { Stop-NewInstance; Restore-Previous }
    # the result is written first, so the previous version finds it when it starts
    if ($swapped) { Write-Result 'rolled-back' "The update to $NewVersion could not be completed ($why). Saveit put back version $OldVersion and it is running normally." $OldVersion }
    else { Write-Result 'unchanged' "The update to $NewVersion could not be installed ($why). Nothing was changed, and version $OldVersion is running normally." $OldVersion }
    $again = Start-Saveit $false
    Problem "The update to $NewVersion could not be completed, so Saveit is on version $OldVersion and has been opened again."
    Log "started the previous version (pid $($again.Id))"
  }
  catch {
    $installed = ''
    Problem "The update could not be completed and the previous version could not be put back automatically. Run Saveit-Setup.exe again to repair it; your library and settings are untouched."
    Log "RECOVERY PROBLEM: $($_.Exception.Message)"
    Write-Result 'failed' "The update to $NewVersion failed ($why) and the previous version could not be restored automatically. A backup of version $OldVersion is in $backup. Re-run Install.cmd from a downloaded release to repair Saveit; your library and settings are untouched." $installed
  }
  exit 1
}
