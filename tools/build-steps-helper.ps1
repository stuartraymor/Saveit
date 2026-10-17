# Builds app\saveit-steps.exe (the Step Capture click and keyboard helper) from native\saveit-steps.cs.
# Uses the C# compiler that ships with Windows, so no SDK is needed.
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-steps-helper.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { throw 'The .NET Framework C# compiler was not found.' }
& $csc /nologo /optimize /target:winexe /platform:x64 "/out:$root\app\saveit-steps.exe" "$root\native\saveit-steps.cs"
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
Get-Item "$root\app\saveit-steps.exe" | Select-Object Name, Length, LastWriteTime
