# Update the installed Saveit from this source folder (app\), keeping the user's library and settings.
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\update-installed.ps1
# 1. backs up the installed app and the whole profile (%APPDATA%\Saveit) next to the source folder, and verifies the copy
# 2. stops the running Saveit, copies app\ over the installed app, verifies every file
# 3. checks the profile is byte-for-byte unchanged, sets the Windows "Installed apps" version, reopens Saveit
$ErrorActionPreference='Stop'
$src=Join-Path (Split-Path $PSScriptRoot -Parent) 'app'
$version=(Get-Content (Join-Path $src 'package.json') -Raw|ConvertFrom-Json).version
$installDir=Join-Path $env:LOCALAPPDATA 'Programs\Saveit'
$exe=Join-Path $installDir 'Saveit.exe'
$installedApp=Join-Path $installDir 'resources\app'
if(-not(Test-Path $exe)){throw 'Saveit is not installed; run Install.cmd instead'}
if($env:SAVEIT_REVIEW_DATA){throw 'Unexpected review-profile override'}
$backupRoot=Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) ("Saveit-library-backup-before-$version-"+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backupRoot|Out-Null
$runtimeHash=(Get-FileHash -LiteralPath $exe).Hash
$procs=Get-CimInstance Win32_Process -Filter "Name = 'Saveit.exe'"|Where-Object{$_.ExecutablePath -eq $exe}
$procs|ForEach-Object{Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue}
foreach($p in $procs){Wait-Process -Id $p.ProcessId -Timeout 15 -ErrorAction SilentlyContinue}
if(Get-CimInstance Win32_Process -Filter "Name = 'Saveit.exe'"|Where-Object{$_.ExecutablePath -eq $exe}){throw 'Saveit is still running'}
Copy-Item -LiteralPath $installedApp -Destination (Join-Path $backupRoot 'app-before') -Recurse
$manifest=@()
foreach($name in @('Saveit','Capture Bench')){
 $profile=Join-Path $env:APPDATA $name
 if(-not(Test-Path -LiteralPath $profile)){continue}
 $copy=Join-Path $backupRoot ('profile-'+$name)
 Copy-Item -LiteralPath $profile -Destination $copy -Recurse -Force
 foreach($f in Get-ChildItem -LiteralPath $profile -Recurse -File -Force){
  $rel=$f.FullName.Substring($profile.Length+1);$h=(Get-FileHash -LiteralPath $f.FullName).Hash
  if((Get-FileHash -LiteralPath (Join-Path $copy $rel)).Hash -ne $h){throw ('Backup verification failed: '+$rel)}
  $manifest+=[pscustomobject]@{Profile=$name;File=$rel;SHA256=$h}}}
if(-not $manifest.Count){throw 'No user profile was backed up'}
Get-ChildItem -LiteralPath $src -Force|Copy-Item -Destination $installedApp -Recurse -Force
$count=0
foreach($f in Get-ChildItem -LiteralPath $src -Recurse -File){$rel=$f.FullName.Substring($src.Length+1);if((Get-FileHash -LiteralPath $f.FullName).Hash -ne (Get-FileHash -LiteralPath (Join-Path $installedApp $rel)).Hash){throw ('Installed file mismatch: '+$rel)};$count++}
foreach($e in $manifest){if((Get-FileHash -LiteralPath (Join-Path (Join-Path $env:APPDATA $e.Profile) $e.File)).Hash -ne $e.SHA256){Write-Warning ('Profile file changed since backup (Saveit was running?): '+$e.File)}}
if((Get-FileHash -LiteralPath $exe).Hash -ne $runtimeHash){throw 'Runtime changed unexpectedly'}
Set-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Saveit' DisplayVersion $version
[pscustomobject]@{Version=$version;InstalledFilesVerified=$count;ProfileFilesBackedUp=$manifest.Count;Backup=$backupRoot}|ConvertTo-Json
Start-Process -FilePath $exe -WorkingDirectory $installDir
