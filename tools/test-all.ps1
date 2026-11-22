<#
Saveit test runner: one command, one summary.

  powershell -NoProfile -ExecutionPolicy Bypass -File tools\test-all.ps1 -Quick                 # 5-10 min: node tests + the main real-app checks
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\test-all.ps1 -Quick -Area grabtext   # only what belongs to one part of Saveit
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\test-all.ps1 -Full                  # everything (about 45 min), before installing or releasing
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\test-all.ps1 -Full -Stress          # also the 500-picture Grab Text stress test (+15-25 min)

Areas: grabtext, capture, editor, library, video, audio, update (several: -Area grabtext,capture).

- Never runs the installed Saveit: it copies the installed program once to %TEMP%\saveit-test-runtime and puts this
  repository's app\ folder into that copy. Every real-app test uses its own throw-away profile.
- Browser suites (no real screen needed) run several at a time (-Parallel, default 3), in Chrome when it is installed
  (SAVEIT_BROWSER_PATH), otherwise in Edge. Real-app tests share the mouse and screen, so they run one at a time.
- A failure listed in tests\known-failures.json (it failed the same way in the last release) is reported as KNOWN;
  anything else is NEW. The exit code is 1 when there is a NEW failure.
- Playwright: set SAVEIT_NODE_MODULES (or NODE_PATH) to a node_modules folder that has playwright, or install it in the
  repository (npm install playwright). Don't touch the mouse or keyboard while real-app tests run.
Results: <Out>\summary.txt (and summary.json), with one log per test.
#>
param(
  [switch]$Quick, [switch]$Full, [switch]$Stress,
  [string[]]$Area = @(),
  [int]$Parallel = 3,
  [string]$Out = (Join-Path $env:TEMP ('saveit-tests-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))),
  [string]$Runtime = (Join-Path $env:TEMP 'saveit-test-runtime'),
  [switch]$FreshRuntime
)
$ErrorActionPreference = 'Stop'
if (-not $Quick -and -not $Full) { $Quick = $true }
$Repo = Split-Path -Parent $PSScriptRoot
$Area = @($Area | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $_ })
$t0 = Get-Date
New-Item -ItemType Directory -Force -Path $Out | Out-Null

# ---- tools ----
$nm = @($env:SAVEIT_NODE_MODULES, $env:NODE_PATH, (Join-Path $Repo 'node_modules'), (Join-Path (Split-Path $Repo -Parent) 'CadCraft\node_modules')) |
  Where-Object { $_ -and (Test-Path (Join-Path $_ 'playwright')) } | Select-Object -First 1
if (-not $nm) { throw 'Playwright not found. Set SAVEIT_NODE_MODULES to a node_modules folder that has playwright, or run: npm install playwright' }
$env:NODE_PATH = $nm
if (-not $env:SAVEIT_BROWSER_PATH) {
  $chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($chrome) { $env:SAVEIT_BROWSER_PATH = $chrome }
}

# ---- runtime copy (never the installed program itself) ----
$installed = Join-Path $env:LOCALAPPDATA 'Programs\Saveit'
if ($Runtime -like "$installed*") { throw 'The test runtime must not be the installed Saveit.' }
if ($FreshRuntime -and (Test-Path $Runtime)) { Remove-Item -Recurse -Force $Runtime }
if (-not (Test-Path (Join-Path $Runtime 'Saveit.exe'))) {
  if (-not (Test-Path (Join-Path $installed 'Saveit.exe'))) { throw "Saveit is not installed at $installed; pass -Runtime with a folder holding a Saveit.exe runtime copy." }
  Write-Host "Making the test runtime copy in $Runtime ..."
  Copy-Item -Recurse -Force $installed $Runtime
}
$appCopy = Join-Path $Runtime 'resources\app'
if (Test-Path $appCopy) { Remove-Item -Recurse -Force $appCopy }
Copy-Item -Recurse -Force (Join-Path $Repo 'app') $appCopy
$Exe = Join-Path $Runtime 'Saveit.exe'
$env:SAVEIT_ELECTRON_PATH = $Exe

# ---- what to run ----
# kind: node | browser (url + evidence) | native (exe + evidence) | nativeApp (exe + app + evidence) | ocr (exe + evidence)
$T = @(
  @{ n='node-tests';                    k='node';      a=@('tests\run-node-tests.js');      areas='all';      quick=1 }
  @{ n='ocr-fixline-tests';             k='node';      a=@('tests\ocr-fixline-tests.js');   areas='grabtext'; quick=1 }
  @{ n='review2-tests';                 k='browser';   areas='grabtext,editor'; quick=1 }
  @{ n='review103-tests';               k='browser';   areas='editor,video,audio' }
  @{ n='polish-tests';                  k='browser';   areas='editor'; quick=1 }
  @{ n='rotate-tests';                  k='browser';   areas='editor' }
  @{ n='flatten-tools-tests';           k='browser';   areas='editor' }
  @{ n='stepguide-tests';               k='browser';   areas='library,editor' }
  @{ n='layer-media-tests';             k='browser';   areas='library,video,audio' }
  @{ n='update-ui-tests';               k='browser';   areas='update' }
  @{ n='video-editor-tests';            k='browser';   areas='video' }
  @{ n='video-flow-tests';              k='browser';   areas='video' }
  @{ n='video-annotation-tests';        k='browser';   areas='video' }
  @{ n='video-timeline-controls';       k='browser';   areas='video' }
  @{ n='video-recording-matrix';        k='browser';   areas='video' }
  @{ n='video-audio-gaps';              k='browser';   areas='video,audio' }
  @{ n='audio94-tests';                 k='browser';   areas='audio' }
  @{ n='audio113-tests';                k='browser';   areas='audio' }
  @{ n='audio114-tests';                k='browser';   areas='audio' }
  @{ n='audio115-tests';                k='browser';   areas='audio' }
  @{ n='audio116-tests';                k='browser';   areas='audio' }
  @{ n='audio-export-tests';            k='browser';   areas='audio' }
  @{ n='audio-pitch-tests';             k='browser';   areas='audio' }
  @{ n='voice-effects-tests';           k='browser';   areas='audio' }
  @{ n='native-grabtext-window';        k='native';    areas='grabtext,library'; quick=1 }
  @{ n='native-grabtext-10312';         k='nativeOcr'; areas='grabtext' }
  @{ n='native-capture-hides-saveit';   k='native';    areas='capture,grabtext'; quick=1 }
  @{ n='native-capture-timing';         k='native';    areas='capture' }
  @{ n='native-bar-parity';             k='native';    areas='capture'; quick=1 }
  @{ n='native-widget-hide1022';        k='native';    areas='capture' }
  @{ n='native-gui-10310';              k='native';    areas='capture,editor' }
  @{ n='native-walkthrough';            k='native';    areas='editor,capture'; quick=1 }
  @{ n='native-workflow-everyday';      k='native';    areas='library,editor,capture' }
  @{ n='native-workflow-paste-layer';   k='native';    areas='library,editor' }
  @{ n='native-live-scroll';            k='native';    areas='capture' }
  @{ n='native-window-capture';         k='native';    areas='capture' }
  @{ n='native-window-capture-1053';    k='native';    areas='capture'; quick=1 }
  @{ n='native-scroll-1053';            k='native';    areas='capture'; quick=1 }
  @{ n='native-page-1053';              k='native';    areas='grabtext,capture'; quick=1 }
  @{ n='native-page-1054';              k='native';    areas='grabtext'; quick=1 }
  @{ n='native-callout1111';            k='nativeApp'; areas='editor' }
  @{ n='native-clipboard1110';          k='nativeApp'; areas='editor' }
  @{ n='native-stepguide';              k='nativeApp'; areas='library,editor' }
  @{ n='native-ocr1112';                k='nativeApp'; areas='grabtext' }
  @{ n='native-video119';               k='nativeApp'; areas='video' }
  @{ n='native-video-journey';          k='nativeApp'; areas='video' }
  @{ n='native-video-timeline-journey'; k='nativeApp'; areas='video' }
  @{ n='native-audio113';               k='nativeApp'; areas='audio' }
  @{ n='native-audio114';               k='nativeApp'; areas='audio' }
  @{ n='native-audio115';               k='nativeApp'; areas='audio' }
  @{ n='native-audio116';               k='nativeApp'; areas='audio' }
  @{ n='native-steps-helper';           k='node';      a=@('tests\native-steps-helper.cjs'); areas='capture' }
  @{ n='ocr-bench';                     k='ocr';       areas='grabtext'; full=1 }
  @{ n='ocr-stress-contrast';           k='ocr';       areas='grabtext'; full=1 }
  @{ n='ocr-stress';                    k='ocr';       areas='grabtext'; stress=1 }
)
$sel = $T | Where-Object {
  $ar = $_.areas -split ','
  $inArea = (-not $Area.Count) -or ($ar -contains 'all') -or (@($ar | Where-Object { $Area -contains $_ }).Count -gt 0)
  if ($_.stress) { return $Stress -and $inArea }
  if ($Full) { return $inArea }
  if ($_.full) { return $false }
  if ($Area.Count) { return $inArea }
  return [bool]$_.quick
}
$known = @{}
$kf = Join-Path $Repo 'tests\known-failures.json'
if (Test-Path $kf) { (Get-Content $kf -Raw | ConvertFrom-Json).suites.PSObject.Properties | ForEach-Object { $known[$_.Name] = @($_.Value.fails) } }

$results = New-Object System.Collections.ArrayList
function Get-Fails([string]$log) { @(Get-Content $log -ErrorAction SilentlyContinue | Where-Object { $_ -match '^(FAIL|not ok)\b' } | ForEach-Object { ($_ -replace '^(FAIL|not ok)\s*', '').Trim() }) }
function Add-Result($name, $code, $secs, $log) {
  $fails = Get-Fails $log
  $kn = @($known[$name]); $new = @(); $old = @()
  foreach ($f in $fails) { if ($kn -contains '*' -or @($kn | Where-Object { $_ -and $f.StartsWith($_) }).Count) { $old += $f } else { $new += $f } }
  $tail = (Get-Content $log -Tail 3 -ErrorAction SilentlyContinue) -join ' '
  $status = if ($code -eq 0) { 'PASS' } elseif ($fails.Count -and -not $new.Count) { 'KNOWN' } else { 'FAIL' }
  if ($code -ne 0 -and -not $fails.Count -and $kn -contains '*') { $status = 'KNOWN' }
  [void]$results.Add([pscustomobject]@{ name = $name; status = $status; exit = $code; seconds = [int]$secs; newFailures = $new; knownFailures = $old; tail = $tail.Substring(0, [Math]::Min(300, $tail.Length)) })
  $c = @{ PASS = 'Green'; KNOWN = 'Yellow'; FAIL = 'Red' }[$status]
  Write-Host ('{0,-6} {1,-32} {2,5}s' -f $status, $name, [int]$secs) -ForegroundColor $c
  foreach ($f in $new) { Write-Host "         NEW: $f" -ForegroundColor Red }
}
function Invoke-Test($name, [string[]]$argv, [int]$timeoutSec = 900) {
  $log = Join-Path $Out "$name.log"; $s = Get-Date
  $p = Start-Process -FilePath 'node' -ArgumentList ($argv | ForEach-Object { '"' + $_ + '"' }) -WorkingDirectory $Repo -NoNewWindow -PassThru -RedirectStandardOutput $log -RedirectStandardError "$log.err"
  $null = $p.Handle  # PowerShell 5.1 reports no exit code unless the handle is kept
  if (-not $p.WaitForExit($timeoutSec * 1000)) { try { & taskkill /PID $p.Id /T /F | Out-Null } catch {} ; Add-Content $log "FAIL timed out after $timeoutSec s"; $code = 124 } else { $code = $p.ExitCode }
  if (Test-Path "$log.err") { Get-Content "$log.err" | Where-Object { $_ -notmatch 'DEP0190|trace-deprecation' } | Add-Content $log; Remove-Item "$log.err" }
  Add-Result $name $code ((Get-Date) - $s).TotalSeconds $log
}

Write-Host "Saveit tests ($(if ($Full) { 'full' } else { 'quick' })$(if ($Area.Count) { ', ' + ($Area -join ',') })): $(@($sel).Count) tests. Results: $Out"

# 1. node tests
foreach ($t in @($sel | Where-Object { $_.k -eq 'node' })) { Invoke-Test $t.n $t.a 900 }

# 2. browser suites, several at a time, against a harness copy of the app
$br = @($sel | Where-Object { $_.k -eq 'browser' })
if ($br.Count) {
  $h = Join-Path $Out 'harness'; & node (Join-Path $Repo 'tests\build-harness.js') $h | Out-Null
  $port = 8990
  $srv = Start-Process -FilePath 'node' -ArgumentList '"tests\serve.js"', ('"' + $h + '"'), $port -WorkingDirectory $Repo -NoNewWindow -PassThru -RedirectStandardOutput (Join-Path $Out 'serve.log') -RedirectStandardError (Join-Path $Out 'serve.err')
  Start-Sleep -Milliseconds 1500
  try {
    $queue = New-Object System.Collections.Queue; $br | ForEach-Object { $queue.Enqueue($_) }; $running = @()
    while ($queue.Count -or $running.Count) {
      while ($queue.Count -and $running.Count -lt [Math]::Max(1, $Parallel)) {
        $t = $queue.Dequeue(); $ev = Join-Path $Out ('ev\' + $t.n); New-Item -ItemType Directory -Force -Path $ev | Out-Null
        $log = Join-Path $Out ($t.n + '.log'); $file = (Get-ChildItem (Join-Path $Repo 'tests') -Filter ($t.n + '.*') | Select-Object -First 1).Name
        $p = Start-Process -FilePath 'node' -ArgumentList ('"tests\' + $file + '"'), "http://127.0.0.1:$port", ('"' + $ev + '"') -WorkingDirectory $Repo -NoNewWindow -PassThru -RedirectStandardOutput $log -RedirectStandardError "$log.err"; $null = $p.Handle
        $running += [pscustomobject]@{ t = $t; p = $p; s = Get-Date; log = $log }
      }
      Start-Sleep -Milliseconds 500
      foreach ($r in @($running)) {
        $late = ((Get-Date) - $r.s).TotalSeconds -gt 900
        if ($r.p.HasExited -or $late) {
          if ($late -and -not $r.p.HasExited) { try { & taskkill /PID $r.p.Id /T /F | Out-Null } catch {} ; Add-Content $r.log 'FAIL timed out after 900 s'; $code = 124 } else { $r.p.WaitForExit(); $code = $r.p.ExitCode }
          if (Test-Path "$($r.log).err") { Get-Content "$($r.log).err" | Where-Object { $_ -notmatch 'DEP0190|trace-deprecation' } | Add-Content $r.log; Remove-Item "$($r.log).err" }
          Add-Result $r.t.n $code ((Get-Date) - $r.s).TotalSeconds $r.log
          $running = @($running | Where-Object { $_ -ne $r })
        }
      }
    }
  } finally { try { & taskkill /PID $srv.Id /T /F | Out-Null } catch {} }
}

# 3. real app, one at a time (they use the real screen and mouse)
# The 10.3.12 Grab Text test reads pictures that the OCR benchmark draws (table@1x.png and others), so the benchmark
# runs first when that test is chosen; it then counts as the ocr-bench result too.
$benchEv = Join-Path $Out 'n-ocr-bench'; $benchDone = $false
foreach ($t in @($sel | Where-Object { $_.k -in 'native', 'nativeApp', 'nativeOcr', 'ocr' })) {
  $file = 'tests\' + $t.n + '.cjs'; $ev = Join-Path $Out ('n-' + $t.n)
  switch ($t.k) {
    'native'    { Invoke-Test $t.n @($file, $Exe, $ev) 900 }
    'nativeApp' { Invoke-Test $t.n @($file, $Exe, (Join-Path $Repo 'app'), $ev) 1200 }
    'ocr'       { if ($t.n -eq 'ocr-bench' -and $benchDone) { continue } Invoke-Test $t.n @($file, $Exe, $ev) $(if ($t.n -eq 'ocr-stress') { 3600 } else { 1800 }); if ($t.n -eq 'ocr-bench') { $benchDone = $true } }
    'nativeOcr' {
      if (-not $benchDone) { Invoke-Test 'ocr-bench' @('tests\ocr-bench.cjs', $Exe, $benchEv) 1800; $benchDone = $true }
      Invoke-Test $t.n @($file, $Exe, $benchEv, $ev) 900
    }
  }
}

# ---- summary ----
$mins = [Math]::Round(((Get-Date) - $t0).TotalMinutes, 1)
$pass = @($results | Where-Object status -eq 'PASS').Count; $kn = @($results | Where-Object status -eq 'KNOWN').Count; $bad = @($results | Where-Object status -eq 'FAIL')
$lines = @("Saveit $((Get-Content (Join-Path $Repo 'app\package.json') -Raw | ConvertFrom-Json).version) tests, $(Get-Date -Format 'yyyy-MM-dd HH:mm'), $mins min: $pass passed, $kn known failures only, $($bad.Count) with NEW failures", '')
foreach ($r in $results) { $lines += ('{0,-6} {1,-32} {2,5}s  {3}' -f $r.status, $r.name, $r.seconds, $(if ($r.status -eq 'PASS') { '' } else { $r.tail })); foreach ($f in $r.newFailures) { $lines += "         NEW: $f" } }
$lines | Set-Content -Encoding UTF8 (Join-Path $Out 'summary.txt')
$results | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $Out 'summary.json')
Write-Host ''; Write-Host $lines[0] -ForegroundColor $(if ($bad.Count) { 'Red' } else { 'Green' }); Write-Host "Details: $(Join-Path $Out 'summary.txt')"
exit $(if ($bad.Count) { 1 } else { 0 })
