# Drives saveit-steps.exe against a small test window of its own (a text box and an OK button), then prints every line the helper sent.
# It moves the mouse and types into THIS window only, and stops if the window did not get the keyboard focus.
#   powershell -NoProfile -ExecutionPolicy Bypass -File tests\steps-helper-live.ps1 -Helper app\saveit-steps.exe
param([Parameter(Mandatory)][string]$Helper)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class LiveW {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
'@
[void][LiveW]::SetProcessDPIAware()
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = (Resolve-Path $Helper).Path; $psi.UseShellExecute = $false; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardInput = $true; $psi.CreateNoWindow = $true
$p = [System.Diagnostics.Process]::Start($psi)
$lines = [System.Collections.ArrayList]::Synchronized((New-Object System.Collections.ArrayList))
Register-ObjectEvent -InputObject $p -EventName OutputDataReceived -MessageData $lines -Action { if ($EventArgs.Data) { [void]$Event.MessageData.Add($EventArgs.Data) } } | Out-Null
$p.BeginOutputReadLine()
function Pump($ms) { $end = (Get-Date).AddMilliseconds($ms); while ((Get-Date) -lt $end) { [System.Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 20 } }
Pump 1500
if (-not ($lines -contains 'READY')) { Write-Output 'RESULT no READY from the helper'; $p.Kill(); exit 2 }
$f = New-Object System.Windows.Forms.Form; $f.Text = 'Saveit helper test'; $f.TopMost = $true; $f.StartPosition = 'Manual'; $f.Location = New-Object System.Drawing.Point(300, 260); $f.ClientSize = New-Object System.Drawing.Size(360, 140)
$tb = New-Object System.Windows.Forms.TextBox; $tb.Name = 'Search'; $tb.AccessibleName = 'Search'; $tb.Location = New-Object System.Drawing.Point(20, 20); $tb.Width = 240
$bt = New-Object System.Windows.Forms.Button; $bt.Text = 'OK'; $bt.Name = 'OkButton'; $bt.Location = New-Object System.Drawing.Point(20, 70)
$pw = New-Object System.Windows.Forms.TextBox; $pw.Name = 'Secret'; $pw.AccessibleName = 'Secret'; $pw.UseSystemPasswordChar = $true; $pw.Location = New-Object System.Drawing.Point(20, 105); $pw.Width = 240
$f.Controls.AddRange(@($tb, $bt, $pw)); $f.Show(); [void][LiveW]::SetForegroundWindow($f.Handle); Pump 700
function Click($c) { $pt = $c.PointToScreen((New-Object System.Drawing.Point([int]($c.Width / 2), [int]($c.Height / 2)))); [System.Windows.Forms.Cursor]::Position = $pt; Pump 150; [LiveW]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero); Pump 60; [LiveW]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero); Pump 450 }
try {
  Click $tb
  if ([LiveW]::GetForegroundWindow() -ne $f.Handle) { Write-Output 'RESULT test window did not get focus; nothing was typed'; throw 'focus' }
  [System.Windows.Forms.SendKeys]::SendWait('abc 42'); Pump 500
  Click $bt                 # ends the typing step, then reports this click
  Click $pw
  if ([LiveW]::GetForegroundWindow() -ne $f.Handle) { Write-Output 'RESULT test window lost focus; nothing more was typed'; throw 'focus' }
  [System.Windows.Forms.SendKeys]::SendWait('hunter2'); Pump 500
  Click $bt                 # a click that follows a password field
  Pump 600
} finally {
  $f.Close()
  $p.StandardInput.Close(); [void]$p.WaitForExit(3000)
  Write-Output ('EXITED ' + $p.HasExited)
  if (-not $p.HasExited) { $p.Kill() }
  foreach ($l in @($lines)) { Write-Output ('LINE ' + $l) }
}
