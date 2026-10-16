param([string]$Path)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$type) { $t = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
[void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
[void][Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($engine -eq $null) { [Console]::Error.WriteLine('NO_ENGINE'); exit 2 }
$source = [System.Drawing.Bitmap]::FromFile($Path)
$lines = [System.Collections.Generic.List[object]]::new()
try {
 if ([long]$source.Width*$source.Height -gt 64000000) { throw 'IMAGE_SIZE_LIMIT' }
 # Small overlapping tiles avoid loss of text on wide/long captures and engine dimension limits.
 $tileSize = 2000; $stride = 1840
 for ($y=0; $y -lt $source.Height; $y+=$stride) {
  for ($x=0; $x -lt $source.Width; $x+=$stride) {
   $w=[Math]::Min($tileSize,$source.Width-$x);$h=[Math]::Min($tileSize,$source.Height-$y)
   $rect=[System.Drawing.Rectangle]::new($x,$y,$w,$h)
   $tile=$source.Clone($rect,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
   $filePath=Join-Path ([System.IO.Path]::GetDirectoryName($Path)) 'tile.png'
   try { $tile.Save($filePath,[System.Drawing.Imaging.ImageFormat]::Png) } finally { $tile.Dispose() }
   $file=Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($filePath)) ([Windows.Storage.StorageFile])
   $stream=Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
   $bitmap=$null
   try {
    $decoder=Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap=Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result=Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    foreach ($line in $result.Lines) {
     $words=@();$left=[double]::MaxValue;$top=[double]::MaxValue;$right=0;$bottom=0
     foreach ($word in $line.Words) {
      $r=$word.BoundingRect;$words+=@{text=$word.Text;rect=@{x=$r.X+$x;y=$r.Y+$y;w=$r.Width;h=$r.Height}}
      $left=[Math]::Min($left,$r.X+$x);$top=[Math]::Min($top,$r.Y+$y);$right=[Math]::Max($right,$r.X+$r.Width+$x);$bottom=[Math]::Max($bottom,$r.Y+$r.Height+$y)
     }
     if ($words.Count -gt 0) { $lines.Add(@{text=$line.Text;words=@($words);rect=@{x=$left;y=$top;w=$right-$left;h=$bottom-$top}}) }
    }
   } finally { if($bitmap){$bitmap.Dispose()};$stream.Dispose() }
  }
 }
 @{lines=@($lines.ToArray());width=$source.Width;height=$source.Height} | ConvertTo-Json -Depth 8 -Compress
} finally { $source.Dispose() }
