param([string]$Path,[double]$Scale=0)
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
 # Windows OCR reads small text far more accurately when it is larger (a capital J in 12 px UI text is read as 1 at 1x), so every tile is enlarged first.
 # Word positions are divided by the scale again below, so they stay in the original picture's pixels.
 if ($Scale -le 0) { $Scale = 2; if ($source.Width -le 1000 -and $source.Height -le 700) { $Scale = 3 } }
 $tileSize = [Math]::Min(2000,[int][Math]::Floor(4000/$Scale)); $stride = $tileSize - 160
 for ($y=0; $y -lt $source.Height; $y+=$stride) {
  for ($x=0; $x -lt $source.Width; $x+=$stride) {
   $w=[Math]::Min($tileSize,$source.Width-$x);$h=[Math]::Min($tileSize,$source.Height-$y)
   $rect=[System.Drawing.Rectangle]::new($x,$y,$w,$h)
   $tile=$source.Clone($rect,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
   $filePath=Join-Path ([System.IO.Path]::GetDirectoryName($Path)) 'tile.png'
   try {
     if ($Scale -ne 1) { $sw=[int][Math]::Round($w*$Scale);$sh=[int][Math]::Round($h*$Scale);$sb=New-Object System.Drawing.Bitmap($sw,$sh);$gr=[System.Drawing.Graphics]::FromImage($sb);$gr.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;$gr.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality;$gr.DrawImage($tile,0,0,$sw,$sh);$gr.Dispose();try { $sb.Save($filePath,[System.Drawing.Imaging.ImageFormat]::Png) } finally { $sb.Dispose() } }
     else { $tile.Save($filePath,[System.Drawing.Imaging.ImageFormat]::Png) }
    } finally { $tile.Dispose() }
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
      $r=$word.BoundingRect;$words+=@{text=$word.Text;rect=@{x=$r.X/$Scale+$x;y=$r.Y/$Scale+$y;w=$r.Width/$Scale;h=$r.Height/$Scale}}
      $left=[Math]::Min($left,$r.X/$Scale+$x);$top=[Math]::Min($top,$r.Y/$Scale+$y);$right=[Math]::Max($right,($r.X+$r.Width)/$Scale+$x);$bottom=[Math]::Max($bottom,($r.Y+$r.Height)/$Scale+$y)
     }
     if ($words.Count -gt 0) { $lines.Add(@{text=$line.Text;words=@($words);rect=@{x=$left;y=$top;w=$right-$left;h=$bottom-$top}}) }
    }
   } finally { if($bitmap){$bitmap.Dispose()};$stream.Dispose() }
  }
 }
 @{lines=@($lines.ToArray());width=$source.Width;height=$source.Height} | ConvertTo-Json -Depth 8 -Compress
} finally { $source.Dispose() }
