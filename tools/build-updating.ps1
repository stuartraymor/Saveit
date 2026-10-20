# Builds app\saveit-updating.exe (the "Updating Saveit" progress window used by Check for Updates) from native\saveit-updating.cs.
# Uses the C# compiler that ships with Windows, so no SDK is needed.
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-updating.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { throw 'The .NET Framework C# compiler was not found.' }
$refs = 'System.Windows.Forms.dll', 'System.Drawing.dll'
& $csc /nologo /optimize /target:winexe /platform:anycpu "/out:$root\app\saveit-updating.exe" "/win32icon:$root\app\icon.ico" `
  "/resource:$root\app\icon.png,logo.png" "/resource:$root\app\icon.ico,app.ico" ($refs | ForEach-Object { "/reference:$_" }) "$root\native\saveit-updating.cs"
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
Get-Item "$root\app\saveit-updating.exe" | Select-Object Name, Length, LastWriteTime
