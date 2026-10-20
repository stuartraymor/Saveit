# Drives Saveit-Setup.exe like a person: opens it, clicks Install, waits, checks the result. Installs into a scratch folder, never the real one.
#   powershell -NoProfile -ExecutionPolicy Bypass -File tests\setup-ui-test.ps1 -Setup C:\path\Saveit-Setup.exe -Work C:\scratch\setup-run
param([Parameter(Mandatory)][string]$Setup, [Parameter(Mandatory)][string]$Work)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Drawing, System.Windows.Forms
Add-Type @'
using System; using System.Runtime.InteropServices;
public static class W { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; } }
'@
[W]::SetProcessDPIAware() | Out-Null
Remove-Item $Work -Recurse -Force -ErrorAction SilentlyContinue; New-Item -ItemType Directory -Path $Work -Force | Out-Null
$root = Join-Path $Work 'root'; $fails = 0
function Check($name, $ok, $extra) { if ($ok) { Write-Host "PASS $name $extra" } else { Write-Host "FAIL $name $extra"; $script:fails++ } }
$env:SAVEIT_REVIEW_DATA = Join-Path $Work 'profile'; $env:SAVEIT_SETUP_TEST_ROOT = $root
$p = Start-Process $Setup -PassThru
$h = [IntPtr]::Zero; for ($i = 0; $i -lt 40 -and $h -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 250; $p.Refresh(); $h = $p.MainWindowHandle }
Check 'setup window opens' ($h -ne [IntPtr]::Zero)
[W]::SetForegroundWindow($h) | Out-Null; Start-Sleep -Milliseconds 400
$root_el = [Windows.Automation.AutomationElement]::FromHandle($h)
function Shot($name) { $r = New-Object W+RECT; [W]::GetWindowRect($h, [ref]$r) | Out-Null; $bmp = New-Object Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T); $g = [Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size); $bmp.Save((Join-Path $Work "$name.png")); $g.Dispose(); $bmp.Dispose() }
function Button($text) { $c = New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty, $text); $root_el.FindFirst([Windows.Automation.TreeScope]::Descendants, $c) }
function Press($el) { try { $el.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern).Invoke() } catch { $r = $el.Current.BoundingRectangle; [Windows.Forms.Cursor]::Position = New-Object Drawing.Point ([int]($r.X + $r.Width / 2)), ([int]($r.Y + $r.Height / 2)); Add-Type -Name M -Namespace N -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int f,int x,int y,int d,int e);' -ErrorAction SilentlyContinue; [N.M]::mouse_event(2,0,0,0,0); [N.M]::mouse_event(4,0,0,0,0) } }
Shot '1-welcome'
$b = Button 'Install'; Check 'Install button is on the first page' ($null -ne $b)
Press $b
Start-Sleep -Seconds 2; Shot '2-installing'
Check 'no buttons while installing' (($null -eq (Button 'Install')) -and ($null -eq (Button 'Cancel')))
$deadline = (Get-Date).AddMinutes(6); $mid = $false; $open = $null
while ((Get-Date) -lt $deadline) { Start-Sleep -Seconds 2; if (-not $mid) { $mid = $true; Shot '3-installing-later' }; $open = Button 'Open Saveit'; if ($open) { break }; if (Button 'Show details') { break }; if ($p.HasExited) { break } }
Start-Sleep -Milliseconds 600; Shot '4-finished'
Check 'finished on the Done page' ($null -ne $open)
$dest = Join-Path $root 'Programs\Saveit'
Check 'Saveit.exe installed' (Test-Path (Join-Path $dest 'Saveit.exe'))
Check 'app files installed' (Test-Path (Join-Path $dest 'resources\app\main.js'))
Check 'uninstaller installed' (Test-Path (Join-Path $dest 'Uninstall.cmd'))
Check 'Start menu and desktop shortcuts' ((Test-Path (Join-Path $root 'StartMenu\Saveit.lnk')) -and (Test-Path (Join-Path $root 'Desktop\Saveit.lnk')))
$ver = (Get-Content (Join-Path $dest 'resources\app\package.json') -Raw | ConvertFrom-Json).version
Check 'registry entry shows the version' ((Get-ItemProperty 'HKCU:\Software\SaveitSetupTest\Saveit').DisplayVersion -eq $ver) $ver
Check 'temporary unpack folder removed' (-not (Get-ChildItem $env:TEMP -Directory -Filter 'Saveit-Setup-*' -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-10) }))
if ($open) { $btn = Button 'Close'; Press $btn; Start-Sleep -Seconds 1; $p.Refresh(); Check 'Close ends Setup' $p.HasExited }
if (-not $p.HasExited) { $p.Kill() }
Remove-Item 'HKCU:\Software\SaveitSetupTest' -Recurse -Force -ErrorAction SilentlyContinue
if ($fails) { Write-Host "$fails FAILED"; exit 1 } else { Write-Host 'ALL PASSED' }


