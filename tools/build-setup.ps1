# Builds Saveit-Setup.exe, the one-file installer, from native\saveit-setup.cs and a release zip.
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-setup.ps1 -Zip C:\path\to\Saveit-10.2.4.zip [-Out C:\folder]
# The zip (Saveit/app, install.ps1, ...) is embedded in the exe; the exe unpacks it to a temp folder and runs install.ps1 -FromSetup.
# Uses the C# compiler that ships with Windows, so no SDK is needed. Output: Saveit-Setup.exe next to the zip (or in -Out).
param([Parameter(Mandatory)][string]$Zip, [string]$Out)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { throw 'The .NET Framework C# compiler was not found.' }
$Zip = (Resolve-Path $Zip).Path
if (-not $Out) { $Out = Split-Path $Zip -Parent }
New-Item -ItemType Directory -Path $Out -Force | Out-Null
$exe = Join-Path $Out 'Saveit-Setup.exe'
$refs = 'System.Windows.Forms.dll', 'System.Drawing.dll', 'System.IO.Compression.dll', 'System.IO.Compression.FileSystem.dll'
& $csc /nologo /optimize /target:winexe /platform:anycpu "/out:$exe" "/win32icon:$root\app\icon.ico" `
  "/resource:$Zip,payload.zip" "/resource:$root\app\icon.png,logo.png" "/resource:$root\app\icon.ico,app.ico" `
  ($refs | ForEach-Object { "/reference:$_" }) "$root\native\saveit-setup.cs"
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
Get-Item $exe | Select-Object Name, Length, LastWriteTime
