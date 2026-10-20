param([string]$Path,[double]$Scale=0,[switch]$NoRecover)
# Grab Text: Windows OCR on enlarged tiles.
# 10.1.12: after the first read, ink that looks like text but was not recognised (Windows OCR silently drops words it cannot make sense of,
# for example file paths) is cut out on its own and read again. -NoRecover turns this off.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Collections.Generic; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class Gaps {
  // Ink = pixels that differ clearly from the usual colour of their neighbourhood. Ink not covered by a recognised word is grouped into text-like boxes.
  // r: recognised word boxes (x,y,w,h) in this bitmap's pixels. Returns boxes as x,y,w,h.
  public static int[] Find(Bitmap b, float[] r, int minH, int maxH) {
    int w=b.Width,h=b.Height; var d=b.LockBits(new Rectangle(0,0,w,h),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb); var px=new byte[d.Stride*h]; Marshal.Copy(d.Scan0,px,0,px.Length); int st=d.Stride; b.UnlockBits(d);
    var L=new byte[w*h]; for(int y=0;y<h;y++)for(int x=0;x<w;x++){int i=y*st+x*4;L[y*w+x]=(byte)((px[i+2]*299+px[i+1]*587+px[i]*114)/1000);}
    int B=48,bw=(w+B-1)/B,bh=(h+B-1)/B; var mode=new byte[bw*bh];
    for(int by=0;by<bh;by++)for(int bx=0;bx<bw;bx++){var hist=new int[32];for(int y=by*B;y<Math.Min(h,by*B+B);y++)for(int x=bx*B;x<Math.Min(w,bx*B+B);x++)hist[L[y*w+x]>>3]++;int m=0;for(int k=1;k<32;k++)if(hist[k]>hist[m])m=k;mode[by*bw+bx]=(byte)(m*8+4);}
    var ink=new bool[w*h]; for(int y=0;y<h;y++)for(int x=0;x<w;x++)ink[y*w+x]=Math.Abs(L[y*w+x]-mode[(y/B)*bw+x/B])>60;
    for(int k=0;k+3<r.Length;k+=4){float ex=r[k+3]*.3f,ey=r[k+3]*.2f;int x0=Math.Max(0,(int)(r[k]-ex)),y0=Math.Max(0,(int)(r[k+1]-ey)),x1=Math.Min(w,(int)(r[k]+r[k+2]+ex)),y1=Math.Min(h,(int)(r[k+1]+r[k+3]+ey));for(int y=y0;y<y1;y++)for(int x=x0;x<x1;x++)ink[y*w+x]=false;}
    var seen=new bool[w*h]; var comps=new List<int[]>(); var q=new Stack<int>();
    for(int s=0;s<w*h;s++){if(!ink[s]||seen[s])continue;int mnx=w,mny=h,mxx=0,mxy=0,n=0;q.Push(s);seen[s]=true;
      while(q.Count>0){int p=q.Pop(),x=p%w,y=p/w;n++;if(x<mnx)mnx=x;if(x>mxx)mxx=x;if(y<mny)mny=y;if(y>mxy)mxy=y;
        for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++){int nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;int np=ny*w+nx;if(ink[np]&&!seen[np]){seen[np]=true;q.Push(np);}}}
      int cw=mxx-mnx+1,ch=mxy-mny+1; if(n<4||ch>maxH||(ch<=3&&cw>20)||(cw<=3&&ch>maxH/2))continue; comps.Add(new int[]{mnx,mny,cw,ch,n}); if(comps.Count>4000)return new int[0];}
    // merge pieces that sit on the same line and close together into one box
    bool merged=true; while(merged){merged=false;for(int i=0;i<comps.Count&&!merged;i++)for(int j=i+1;j<comps.Count;j++){var a=comps[i];var c=comps[j];
      int ov=Math.Min(a[1]+a[3],c[1]+c[3])-Math.Max(a[1],c[1]),gap=Math.Max(a[0],c[0])-Math.Min(a[0]+a[2],c[0]+c[2]),mh=Math.Max(a[3],c[3]);
      if(ov>=0.4*Math.Min(a[3],c[3])&&gap<=0.9*mh){int x0=Math.Min(a[0],c[0]),y0=Math.Min(a[1],c[1]),x1=Math.Max(a[0]+a[2],c[0]+c[2]),y1=Math.Max(a[1]+a[3],c[1]+c[3]);comps[i]=new int[]{x0,y0,x1-x0,y1-y0,a[4]+c[4]};comps.RemoveAt(j);merged=true;break;}}}
    var outp=new List<int>(); foreach(var c in comps){if(c[3]<minH||c[3]>maxH||c[2]<c[3]*0.6||c[4]<15)continue;outp.AddRange(new int[]{c[0],c[1],c[2],c[3]}); if(outp.Count>=4*40)break;}
    return outp.ToArray();
  }
}
"@
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$type) { $t = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
[void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
[void][Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($engine -eq $null) { [Console]::Error.WriteLine('NO_ENGINE'); exit 2 }
$tilePath=Join-Path ([System.IO.Path]::GetDirectoryName($Path)) 'tile.png'
function Read-Bitmap($bmp) { $bmp.Save($tilePath,[System.Drawing.Imaging.ImageFormat]::Png)
  $file=Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tilePath)) ([Windows.Storage.StorageFile]); $stream=Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream]); $sbm=$null
  try { $dec=Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder]); $sbm=Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap]); return (Await ($engine.RecognizeAsync($sbm)) ([Windows.Media.Ocr.OcrResult])) } finally { if($sbm){$sbm.Dispose()}; $stream.Dispose() } }
# add a recognised line; map(x,y) turns positions in the read bitmap into positions in the original picture
function Add-Lines($result,[scriptblock]$map,[double]$k,[string]$how) { foreach ($line in $result.Lines) { $words=@();$left=[double]::MaxValue;$top=[double]::MaxValue;$right=0;$bottom=0
  foreach ($word in $line.Words) { if ($how -eq 'recovered' -and $word.Text -notmatch '[A-Za-z0-9]') { continue }; $r=$word.BoundingRect;$p=& $map $r.X $r.Y;$ww=$r.Width/$k;$hh=$r.Height/$k
   $words+=@{text=$word.Text;how=$how;rect=@{x=$p[0];y=$p[1];w=$ww;h=$hh}};$left=[Math]::Min($left,$p[0]);$top=[Math]::Min($top,$p[1]);$right=[Math]::Max($right,$p[0]+$ww);$bottom=[Math]::Max($bottom,$p[1]+$hh) }
  if ($words.Count -gt 0) { $script:lines.Add(@{text=(($words|ForEach-Object{$_.text}) -join ' ');words=@($words);rect=@{x=$left;y=$top;w=$right-$left;h=$bottom-$top}}) } } }
$source = [System.Drawing.Bitmap]::FromFile($Path)
$lines = [System.Collections.Generic.List[object]]::new()
try {
 if ([long]$source.Width*$source.Height -gt 64000000) { throw 'IMAGE_SIZE_LIMIT' }
 # Small overlapping tiles avoid loss of text on wide/long captures and engine dimension limits.
 # Windows OCR reads small text far more accurately when it is larger (a capital J in 12 px UI text is read as 1 at 1x), so every tile is enlarged first.
 # Word positions are divided by the scale again, so they stay in the original picture's pixels.
 if ($Scale -le 0) { $Scale = 2; if ($source.Width -le 1000 -and $source.Height -le 700) { $Scale = 3 } }
 $tileSize = [Math]::Min(2000,[int][Math]::Floor(4000/$Scale)); $stride = $tileSize - 160
 for ($y=0; $y -lt $source.Height; $y+=$stride) {
  for ($x=0; $x -lt $source.Width; $x+=$stride) {
   $w=[Math]::Min($tileSize,$source.Width-$x);$h=[Math]::Min($tileSize,$source.Height-$y)
   $tile=$source.Clone([System.Drawing.Rectangle]::new($x,$y,$w,$h),[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
   $sw=[int][Math]::Round($w*$Scale);$sh=[int][Math]::Round($h*$Scale);$sb=New-Object System.Drawing.Bitmap($sw,$sh,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb);$gr=[System.Drawing.Graphics]::FromImage($sb);$gr.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;$gr.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality;$gr.DrawImage($tile,0,0,$sw,$sh);$gr.Dispose();$tile.Dispose()
   try {
    $tx=$x;$ty=$y;$result=Read-Bitmap $sb
    Add-Lines $result { param($a,$b) @(($a/$Scale+$tx),($b/$Scale+$ty)) } $Scale 'first'
    if (-not $NoRecover) {
     $rects=[System.Collections.Generic.List[float]]::new(); foreach ($line in $result.Lines) { foreach ($word in $line.Words) { $r=$word.BoundingRect; $rects.AddRange([float[]]@($r.X,$r.Y,$r.Width,$r.Height)) } }
     $boxes=[Gaps]::Find($sb,$rects.ToArray(),[int](5*$Scale),[int](60*$Scale))
     for ($k=0;$k -lt $boxes.Length;$k+=4) {
      $bx=$boxes[$k];$by=$boxes[$k+1];$bw=$boxes[$k+2];$bh=$boxes[$k+3];$m=[int]($bh*.5);$my=[int]($bh*.12);$cx=[Math]::Max(0,$bx-$m);$cy=[Math]::Max(0,$by-$my);$cw=[Math]::Min($sw-$cx,$bw+2*$m);$ch=[Math]::Min($sh-$cy,$bh+2*$my);$pad=30
      $crop=$sb.Clone([System.Drawing.Rectangle]::new($cx,$cy,$cw,$ch),[System.Drawing.Imaging.PixelFormat]::Format32bppArgb);$bg=$crop.GetPixel(0,0)
      $pb=New-Object System.Drawing.Bitmap(($cw+2*$pad),($ch+2*$pad),[System.Drawing.Imaging.PixelFormat]::Format32bppArgb);$g2=[System.Drawing.Graphics]::FromImage($pb);$g2.Clear($bg);$g2.DrawImage($crop,$pad,$pad,$cw,$ch);$g2.Dispose();$crop.Dispose()
      try { $r2=Read-Bitmap $pb;$ox=$cx;$oy=$cy; Add-Lines $r2 { param($a,$b) @((($a-$pad+$ox)/$Scale+$tx),(($b-$pad+$oy)/$Scale+$ty)) } $Scale 'recovered' } finally { $pb.Dispose() }
     }
    }
   } finally { $sb.Dispose() }
  }
 }
 @{lines=@($lines.ToArray());width=$source.Width;height=$source.Height} | ConvertTo-Json -Depth 8 -Compress
} finally { $source.Dispose() }
