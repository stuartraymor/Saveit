# Uses the Windows .NET Framework compiler, like the other Saveit helpers.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $csc)) { throw 'The Windows C# compiler was not found.' }
& $csc /nologo /optimize /target:exe /platform:x64 "/out:$root\app\saveit-window-bounds.exe" "$root\native\saveit-window-bounds.cs"
if ($LASTEXITCODE -ne 0) { throw 'Window bounds helper build failed.' }
Get-Item "$root\app\saveit-window-bounds.exe" | Select-Object Name, Length
