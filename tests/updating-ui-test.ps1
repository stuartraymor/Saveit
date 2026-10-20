# Looks at the "Updating Saveit" window (app\saveit-updating.exe) with a fake updater script: success path and failure path. Screenshots go to -Work.
#   powershell -NoProfile -ExecutionPolicy Bypass -File tests\updating-ui-test.ps1 -Exe app\saveit-updating.exe -Work C:\scratch\updating-run
param([Parameter(Mandatory)][string]$Exe, [Parameter(Mandatory)][string]$Work)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing, System.Windows.Forms
Add-Type @'
using System; using System.Runtime.InteropServices;
public static class W2 { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; } }
'@
[W2]::SetProcessDPIAware() | Out-Null
Remove-Item $Work -Recurse -Force -ErrorAction SilentlyContinue; New-Item -ItemType Directory -Path $Work -Force | Out-Null
$fails = 0; function Check($n, $ok, $x) { if ($ok) { Write-Host "PASS $n $x" } else { Write-Host "FAIL $n $x"; $script:fails++ } }
function Shot($proc, $name) { $proc.Refresh(); if ($proc.HasExited) { return $false }; if ($proc.MainWindowHandle -eq [IntPtr]::Zero) { return $false }; $r = New-Object W2+RECT; [void][W2]::GetWindowRect($proc.MainWindowHandle, [ref]$r); $b = New-Object Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T); $g = [Drawing.Graphics]::FromImage($b); $g.CopyFromScreen($r.L, $r.T, 0, 0, $b.Size); $b.Save((Join-Path $Work "$name.png")); $g.Dispose(); $b.Dispose(); $true }
function Win($p) { for ($i = 0; $i -lt 40; $i++) { Start-Sleep -Milliseconds 250; $p.Refresh(); if ($p.MainWindowHandle -ne [IntPtr]::Zero) { return $true } }; $false }

# success: waits, then steps up to 100 and exits 0
$ok = Join-Path $Work 'fake-ok.ps1'
@'
param([string]$NewVersion = '', [string]$InstallDir = '')
function P($n, $t) { [Console]::Out.WriteLine("##P $n $t"); [Console]::Out.Flush() }
Start-Sleep -Seconds 1; P 3 'Waiting for Saveit to close...'; Start-Sleep -Seconds 3; P 35 'Installing the new version...'; Start-Sleep -Seconds 4; P 75 "Starting Saveit $NewVersion..."; Start-Sleep -Seconds 3; P 100 'Done'; exit 0
'@ | Set-Content $ok -Encoding utf8
$p = Start-Process $Exe -ArgumentList "`"$ok`"", '-NewVersion', '9.9.9', '-InstallDir', "`"$Work`"" -PassThru
Check 'window opens' (Win $p)
Check 'no extra console window (the updater runs hidden)' (-not (Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -match 'saveit|fake' }))
Start-Sleep -Seconds 3; Shot $p '1-working' | Out-Null
Start-Sleep -Seconds 4; Shot $p '2-later' | Out-Null
Start-Sleep -Milliseconds 3800; Shot $p '3-done' | Out-Null
$p.WaitForExit(15000) | Out-Null; Check 'closes itself after success' $p.HasExited

# failure: reports an error and stays open with a Close button
$bad = Join-Path $Work 'fake-bad.ps1'
@'
param([string]$NewVersion = '')
[Console]::Out.WriteLine('##P 40 Installing the new version...'); [Console]::Out.Flush(); Start-Sleep -Seconds 2
[Console]::Out.WriteLine('##E The update to 9.9.9 could not be completed, so Saveit is on version 9.9.8 and has been opened again.'); [Console]::Out.Flush(); exit 1
'@ | Set-Content $bad -Encoding utf8
$p2 = Start-Process $Exe -ArgumentList "`"$bad`"", '-NewVersion', '9.9.9' -PassThru
Check 'failure: window opens' (Win $p2)
Start-Sleep -Seconds 5; Shot $p2 '4-error' | Out-Null
Check 'failure: window stays open for the person to read' (-not $p2.HasExited)
if (-not $p2.HasExited) { $p2.Kill() }
if ($fails) { Write-Host "$fails FAILED"; exit 1 } else { Write-Host 'ALL PASSED' }



