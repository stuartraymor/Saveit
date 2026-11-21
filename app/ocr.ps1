param([string]$Path,[double]$Scale=0,[switch]$NoRecover,[switch]$Single)
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
    // 10.4.1: pieces as narrow as a quarter of their height are kept (a lone "1" in a table cell); a re-read that gives only l, I or | is dropped in Add-Lines
  // merge pieces that sit on the same line and close together into one box
    bool merged=true; while(merged){merged=false;for(int i=0;i<comps.Count&&!merged;i++)for(int j=i+1;j<comps.Count;j++){var a=comps[i];var c=comps[j];
      int ov=Math.Min(a[1]+a[3],c[1]+c[3])-Math.Max(a[1],c[1]),gap=Math.Max(a[0],c[0])-Math.Min(a[0]+a[2],c[0]+c[2]),mh=Math.Max(a[3],c[3]);
      if(ov>=0.4*Math.Min(a[3],c[3])&&gap<=0.9*mh){int x0=Math.Min(a[0],c[0]),y0=Math.Min(a[1],c[1]),x1=Math.Max(a[0]+a[2],c[0]+c[2]),y1=Math.Max(a[1]+a[3],c[1]+c[3]);comps[i]=new int[]{x0,y0,x1-x0,y1-y0,a[4]+c[4]};comps.RemoveAt(j);merged=true;break;}}}
    var outp=new List<int>(); foreach(var c in comps){if(c[3]<minH||c[3]>maxH||c[2]<c[3]*0.25||c[4]<15)continue;outp.AddRange(new int[]{c[0],c[1],c[2],c[3]}); if(outp.Count>=4*40)break;}
    return outp.ToArray();
  }
}
public static class Prep {
  static byte[] Bytes(Bitmap b,out int st){var d=b.LockBits(new Rectangle(0,0,b.Width,b.Height),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);var px=new byte[d.Stride*b.Height];Marshal.Copy(d.Scan0,px,0,px.Length);st=d.Stride;b.UnlockBits(d);return px;}
  static Bitmap Gray(byte[] g,int w,int h){var b=new Bitmap(w,h,PixelFormat.Format32bppArgb);var d=b.LockBits(new Rectangle(0,0,w,h),ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb);var px=new byte[d.Stride*h];for(int y=0;y<h;y++)for(int x=0;x<w;x++){int i=y*d.Stride+x*4;byte v=g[y*w+x];px[i]=v;px[i+1]=v;px[i+2]=v;px[i+3]=255;}Marshal.Copy(px,0,d.Scan0,px.Length);b.UnlockBits(d);return b;}
  // median of a (w*h, values 0-255) over a (2r+1)^2 window, on 32 levels (Huang's sliding histogram)
  static byte[] Median(byte[] a,int w,int h,int r){var o=new byte[w*h];var hist=new int[32];
    for(int y=0;y<h;y++){Array.Clear(hist,0,32);int y0=Math.Max(0,y-r),y1=Math.Min(h-1,y+r),n=0;
      for(int yy=y0;yy<=y1;yy++)for(int x=0;x<=Math.Min(w-1,r);x++){hist[a[yy*w+x]>>3]++;n++;}
      for(int x=0;x<w;x++){
        if(x>0){int xo=x-r-1,xi=x+r;if(xo>=0)for(int yy=y0;yy<=y1;yy++){hist[a[yy*w+xo]>>3]--;n--;}if(xi<w)for(int yy=y0;yy<=y1;yy++){hist[a[yy*w+xi]>>3]++;n++;}}
        int half=n/2,c=0,k=0;for(;k<32;k++){c+=hist[k];if(c>half)break;}o[y*w+x]=(byte)(k*8+4);}}
    return o;}
  // Dark text on white, whatever the colours: each pixel's difference from the usual colour around it (a median, which keeps the sharp edge between a
  // dark and a light part of the picture), scaled so the strongest text nearby becomes black.
  public static Bitmap Normalize(Bitmap b,int r){int w=b.Width,h=b.Height,st;var px=Bytes(b,out st);var ink=new int[w*h];
    for(int c=0;c<3;c++){var a=new byte[w*h];for(int y=0;y<h;y++)for(int x=0;x<w;x++)a[y*w+x]=px[y*st+x*4+c];var m=Median(a,w,h,r);for(int i=0;i<w*h;i++){int d=Math.Abs(a[i]-m[i]);if(d>ink[i])ink[i]=d;}}
    var hs=new int[256];foreach(var v in ink)hs[v]++;int cum=0,p50=0;for(int k=0;k<256;k++){cum+=hs[k];if(cum>=w*h/2){p50=k;break;}}int nf=Math.Min(40,p50*2+6);
    int R=r*2;var t=new int[w*h];var lm=new int[w*h];
    for(int y=0;y<h;y++)for(int x=0;x<w;x++){int mx=0;for(int k=Math.Max(0,x-R);k<=Math.Min(w-1,x+R);k++)if(ink[y*w+k]>mx)mx=ink[y*w+k];t[y*w+x]=mx;}
    for(int x=0;x<w;x++)for(int y=0;y<h;y++){int mx=0;for(int k=Math.Max(0,y-R);k<=Math.Min(h-1,y+R);k++)if(t[k*w+x]>mx)mx=t[k*w+x];lm[y*w+x]=mx;}
    var g=new byte[w*h];for(int i=0;i<w*h;i++){double top=Math.Max(lm[i],nf+36)-nf;double v=(ink[i]-nf)/top;g[i]=(byte)(255-Math.Max(0,Math.Min(255,v*1.15*255)));}
    return Gray(g,w,h);}
  // Letter proportions: median width/height of the ink pieces of about the usual letter height in a cleaned (dark on white) picture.
  // Returns {aspect, pieces, height}. Ordinary text gives about 0.7; text stretched wide gives more, squeezed or stretched tall gives less.
  static List<int[]> Pieces(Bitmap b){int w=b.Width,h=b.Height,st;var px=Bytes(b,out st);var ink=new bool[w*h];for(int y=0;y<h;y++)for(int x=0;x<w;x++)ink[y*w+x]=px[y*st+x*4+1]<128;
    var seen=new bool[w*h];var comps=new List<int[]>();var q=new Stack<int>();
    for(int s=0;s<w*h;s++){if(!ink[s]||seen[s])continue;int mnx=w,mny=h,mxx=0,mxy=0,n=0;q.Push(s);seen[s]=true;
      while(q.Count>0){int p=q.Pop(),x=p%w,y=p/w;n++;if(x<mnx)mnx=x;if(x>mxx)mxx=x;if(y<mny)mny=y;if(y>mxy)mxy=y;
        for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++){int nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;int np=ny*w+nx;if(ink[np]&&!seen[np]){seen[np]=true;q.Push(np);}}}
      int cw=mxx-mnx+1,ch=mxy-mny+1;if(n>=6&&ch>=4&&ch<h*0.9)comps.Add(new int[]{mnx,mny,cw,ch});if(comps.Count>5000)break;}
    return comps;}
  public static double[] Aspect(Bitmap b){var comps=Pieces(b);if(comps.Count<3)return new double[]{0,comps.Count,0};
    var hs=new List<int>();foreach(var c in comps)hs.Add(c[3]);hs.Sort();int H=hs[hs.Count*2/3];
    var asp=new List<double>();foreach(var c in comps)if(c[3]>=0.6*H&&c[3]<=1.4*H)asp.Add((double)c[2]/c[3]);if(asp.Count<3)return new double[]{0,asp.Count,H};asp.Sort();
    return new double[]{asp[asp.Count/2],asp.Count,H};}
  // Letter-sized ink pieces of a cleaned picture that no recognised word covers (r: word boxes x,y,w,h in the same pixels) and that have another such piece
  // beside them on the same line: text the first reading missed. A lone piece (the rounded corner of a box or button) does not count.
  public static int Uncovered(Bitmap b,float[] r,double H){var u=new List<int[]>();foreach(var c in Pieces(b)){if(H>0&&(c[3]<0.5*H||c[3]>2*H))continue;double cx=c[0]+c[2]/2.0,cy=c[1]+c[3]/2.0;bool cov=false;
      for(int k=0;k+3<r.Length&&!cov;k+=4){double ex=r[k+3]*.3;cov=cx>=r[k]-ex&&cx<=r[k]+r[k+2]+ex&&cy>=r[k+1]-ex&&cy<=r[k+1]+r[k+3]+ex;}if(!cov)u.Add(c);}
    int n=0;foreach(var a in u){foreach(var c in u){if(c==a)continue;int ov=Math.Min(a[1]+a[3],c[1]+c[3])-Math.Max(a[1],c[1]),gap=Math.Max(a[0],c[0])-Math.Min(a[0]+a[2],c[0]+c[2]);
        if(ov>=0.5*Math.Min(a[3],c[3])&&gap<=1.2*Math.Max(a[3],c[3])){n++;break;}}}return n;}
  // How believable a reading is: characters in words that look like real words, numbers, dates, money, addresses or codes count for it;
  // stray single letters and odd symbols count against it. Used to choose between readings of the same picture.
  static readonly System.Text.RegularExpressions.Regex Good=new System.Text.RegularExpressions.Regex(@"^[(""'\[]?([A-Z]?[a-z]+(['’][a-z]+)?|[A-Z]{2,}|[A-Z][a-z]*[A-Z][a-z]+|[$€£#+\-]?\d[\d.,:/\-]*%?|[A-Z]{1,4}[\-#]?\d+[A-Z\d\-]*|\d+[A-Za-z]{1,3}|[\w.\-]+@[\w\-]+\.[\w.]+|(https?://)?[\w\-]+(\.[\w\-]+)+[/\w.\-?=&#%]*|[A-Za-z]:\\[^\s]*|v?\d+(\.\d+)+)[)""'\].,:;!?]*$");
  public static double Score(string[] lines){double s=0;foreach(var line in lines)foreach(var w in line.Split(new[]{' ','\t'},StringSplitOptions.RemoveEmptyEntries)){
      int odd=0,al=0;foreach(char c in w){if(char.IsLetterOrDigit(c)&&c<128)al++;else if(c>=128&&"€£°©’“”".IndexOf(c)<0)odd++;}
      if(w.Length==1){s+="aAI&+-=/|x$#%:()".IndexOf(w[0])>=0||char.IsDigit(w[0])?0.5:-1.5;continue;}
      if(Good.IsMatch(w))s+=w.Length;else s+=al*0.35-1-odd*2;}
    return s;}
  // true when every word of a reading looks right
  public static bool AllGood(string[] lines){foreach(var line in lines)foreach(var w in line.Split(new[]{' ','\t'},StringSplitOptions.RemoveEmptyEntries)){if(w.Length==1?("aAI&+-=/|x$#%:()".IndexOf(w[0])<0&&!char.IsDigit(w[0])):!Good.IsMatch(w))return false;}return true;}
  public static Bitmap Resize(Bitmap b,double fx,double fy){int w=Math.Max(1,(int)Math.Round(b.Width*fx)),h=Math.Max(1,(int)Math.Round(b.Height*fy));var o=new Bitmap(w,h,PixelFormat.Format32bppArgb);using(var g=Graphics.FromImage(o)){g.InterpolationMode=System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;g.PixelOffsetMode=System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;g.DrawImage(b,0,0,w,h);}return o;}
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
# keep (optional): only words for which it returns true are added
function Add-Lines($result,[scriptblock]$map,[double]$k,[string]$how,[scriptblock]$keep=$null) { foreach ($line in $result.Lines) { $words=@();$left=[double]::MaxValue;$top=[double]::MaxValue;$right=0;$bottom=0
  # 10.3.12: a re-read keeps code operators, and quotes or brackets that sit in a line with real words (the " of console.log("Free); other lone marks are noise
  $real=@($line.Words|Where-Object{$_.Text -match '[A-Za-z0-9]'}).Count -gt 0
  foreach ($word in $line.Words) { if ($how -eq 'recovered' -and $word.Text -notmatch '[A-Za-z0-9]' -and $word.Text -notmatch '^(=>|==|!=|<=|>=|&&|\|\||->|===|!==)$' -and -not ($real -and $word.Text -match '^["''`()\[\]{};,]{1,3}$')) { continue }; $r=$word.BoundingRect; if ($keep -and -not (& $keep $r)) { continue }; if ($how -eq 'recovered' -and $word.Text -match '^[lI|!]$') { continue }; $p=& $map $r.X $r.Y;$ww=$r.Width/$k;$hh=$r.Height/$k
   $words+=@{text=$word.Text;how=$how;rect=@{x=$p[0];y=$p[1];w=$ww;h=$hh}};$left=[Math]::Min($left,$p[0]);$top=[Math]::Min($top,$p[1]);$right=[Math]::Max($right,$p[0]+$ww);$bottom=[Math]::Max($bottom,$p[1]+$hh) }
  if ($words.Count -gt 0) { $script:lines.Add(@{text=(($words|ForEach-Object{$_.text}) -join ' ');words=@($words);rect=@{x=$left;y=$top;w=$right-$left;h=$bottom-$top}}) } } }
$original = [System.Drawing.Bitmap]::FromFile($Path)
$lines = [System.Collections.Generic.List[object]]::new()
# Reads one picture (the original, or a cleaned or re-proportioned copy of it) into $script:lines
function Read-Source($source) {
 # Small overlapping tiles avoid loss of text on wide/long captures and engine dimension limits.
 # Windows OCR reads small text far more accurately when it is larger (a capital J in 12 px UI text is read as 1 at 1x), so every tile is enlarged first.
 # Word positions are divided by the scale again, so they stay in the original picture's pixels.
 # 10.3.12: measured on real screenshots, 2x reads best both for 100% and 200% display scaling; 3x and more blur letters together
 # ("in" was read as "m"). Saveit's editor no longer enlarges the picture before this, so 2x is the total enlargement.
 # 10.4.1: Windows OCR sometimes returns nothing at all for a short line it cannot match to words ("x == y && z != 0", "25.5", an e-mail address),
 # although the same picture is read at another enlargement. When a picture of up to 1 megapixel (a selection, not a whole screen) gives no text at 2x, it is read again at 1x, 3x,
 # 1.5x and 4x, and the first enlargement that finds text is used. Pictures with text are read once, as before.
 # 10.4.2: the extra readings of a cleaned or re-proportioned copy (below) are read at 2x only (as accurate on the 240 test pictures as trying
 # other enlargements too, and a picture without text stays quick)
 $scales = if ($Scale -gt 0) { @($Scale) } elseif ($script:extra) { $script:extraScales } elseif ([long]$source.Width*$source.Height -le 1000000) { @(2,1,3,1.5,4) } else { @(2) }
 foreach ($Scale in $scales) {
 if ($lines.Count -gt 0) { break }
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
      $before=$script:lines.Count
      try { $r2=Read-Bitmap $pb;$ox=$cx;$oy=$cy; Add-Lines $r2 { param($a,$b) @((($a-$pad+$ox)/$Scale+$tx),(($b-$pad+$oy)/$Scale+$ty)) } $Scale 'recovered' } finally { $pb.Dispose() }
      # 10.3.12: a short piece, such as the "11" of "2026-11-07", is often not read on its own. Read it again together with the text beside it and keep
      # only the words that cover the missed piece; main.js then lets a longer word ("2026-11-07") replace the pieces it covers ("2026-", "-07").
      # Only short pieces (up to about 4 characters wide) with a recognised word right beside them on the same line are retried: a long piece that could
      # not be read alone is not read with its neighbours either, and icons standing on their own are not text.
      $beside=$false; if ($script:lines.Count -eq $before -and $bw -le $bh*3) { for ($q=0;$q -lt $rects.Count;$q+=4) { $wx=$rects[$q];$wy=$rects[$q+1];$ww2=$rects[$q+2];$wh=$rects[$q+3]
        $ov=[Math]::Min($by+$bh,$wy+$wh)-[Math]::Max($by,$wy); $gap=[Math]::Max($wx-($bx+$bw),$bx-($wx+$ww2))
        if ($ov -ge 0.5*[Math]::Min($bh,$wh) -and $gap -le 1.5*$bh) { $beside=$true; break } } }
      if ($beside) {
       $m=[int]($bh*4);$cx=[Math]::Max(0,$bx-$m);$cw=[Math]::Min($sw-$cx,$bw+2*$m)
       $crop=$sb.Clone([System.Drawing.Rectangle]::new($cx,$cy,$cw,$ch),[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
       $pb=New-Object System.Drawing.Bitmap(($cw+2*$pad),($ch+2*$pad),[System.Drawing.Imaging.PixelFormat]::Format32bppArgb);$g2=[System.Drawing.Graphics]::FromImage($pb);$g2.Clear($bg);$g2.DrawImage($crop,$pad,$pad,$cw,$ch);$g2.Dispose();$crop.Dispose()
       try { $r2=Read-Bitmap $pb;$ox=$cx;$oy=$cy; Add-Lines $r2 { param($a,$b) @((($a-$pad+$ox)/$Scale+$tx),(($b-$pad+$oy)/$Scale+$ty)) } $Scale 'recovered' { param($r) ($r.X-$pad+$ox) -lt ($bx+$bw*.8) -and ($r.X+$r.Width-$pad+$ox) -gt ($bx+$bw*.2) } } finally { $pb.Dispose() }
      }
     }
    }
   } finally { $sb.Dispose() }
  }
 }
 }
}
$script:extra=$false; $script:extraScales=@(2)
# Reads $bmp resized by fx,fy and returns its lines (positions in the original picture) and how believable they are
function Read-Pass($bmp,$fx,$fy,$how) { $script:lines=[System.Collections.Generic.List[object]]::new(); $src=$bmp; if ($fx -ne 1 -or $fy -ne 1) { $src=[Prep]::Resize($bmp,$fx,$fy) }
 try { Read-Source $src } finally { if (-not [object]::ReferenceEquals($src,$bmp)) { $src.Dispose() } }
 if ($fx -ne 1 -or $fy -ne 1) { foreach ($l in $script:lines) { foreach ($r in @($l.rect)+@($l.words|ForEach-Object{$_.rect})) { $r.x/=$fx;$r.w/=$fx;$r.y/=$fy;$r.h/=$fy } } }
 @{lines=$script:lines;score=[Prep]::Score([string[]]@($script:lines|ForEach-Object{$_.text}));how=$how} }
try {
 if ([long]$original.Width*$original.Height -gt 64000000) { throw 'IMAGE_SIZE_LIMIT' }
 # 10.4.2: pictures with bright, dark or mixed areas, faint text, or stretched or squeezed lettering. The picture is read as it is first. Then, for
 # pictures of up to 1 megapixel (a selection, not a whole screen), when that reading has words that do not look right or left letter-like ink unread,
 # it is read again from a cleaned copy (dark text on white everywhere, see Prep.Normalize), and when the letters are unusually wide or narrow, from
 # copies with the width corrected. The most believable reading wins (Prep.Score); a reading that only adds lines where the first found none is also tried.
 # Measured on 240 generated pictures (tests/ocr-stress-contrast.cjs).
 $watch=[Diagnostics.Stopwatch]::StartNew()
 $best=Read-Pass $original 1 1 'original'
 $firstMs=$watch.ElapsedMilliseconds
 if (-not $Single -and $Scale -le 0 -and [long]$original.Width*$original.Height -le 1000000) {
  $texts=[string[]]@($best.lines|ForEach-Object{$_.text}); $clean=$best.lines.Count -gt 0 -and [Prep]::AllGood($texts)
  $nb=[Prep]::Normalize($original,12); $asp=[Prep]::Aspect($nb)
  if ($asp[2] -gt 18) { $nb.Dispose(); $nb=[Prep]::Normalize($original,[int][Math]::Min(40,[Math]::Round($asp[2]*0.75))) }
  try {
   $k=if ($asp[0] -gt 0) { 0.70/$asp[0] } else { 1 }; $odd=$k -lt 0.77 -or $k -gt 1.3; $k=[Math]::Max(0.3,[Math]::Min(2.5,$k))
   $missed=0; if ($clean) { $wr=[System.Collections.Generic.List[float]]::new(); foreach ($l in $best.lines) { foreach ($w in $l.words) { $wr.AddRange([float[]]@($w.rect.x,$w.rect.y,$w.rect.w,$w.rect.h)) } }; $missed=[Prep]::Uncovered($nb,$wr.ToArray(),$asp[2]) }
   if ($env:SAVEIT_OCR_DEBUG) { [Console]::Error.WriteLine("clean=$clean aspect=$($asp -join ',') k=$k missed=$missed t=$($watch.ElapsedMilliseconds) first=$firstMs") }
   if (-not $clean -or $missed -ge 2) {
    $tries=@(,@($nb,1,1,'cleaned')); if ($odd) { $tries+=,@($original,$k,1,'width'); $tries+=,@($nb,$k,1,'cleaned-width') }
    $first=$best; $script:extra=$true
    foreach ($t in $tries) { $r=Read-Pass $t[0] $t[1] $t[2] $t[3]; if ($r.score -gt $best.score+0.5) { $best=$r }
     # lines found only in the extra reading, added to the first reading
     $add=@($r.lines|Where-Object{ $a=$_.rect; -not ($first.lines|Where-Object{ $b=$_.rect; [Math]::Min($a.x+$a.w,$b.x+$b.w)-[Math]::Max($a.x,$b.x) -gt 0 -and [Math]::Min($a.y+$a.h,$b.y+$b.h)-[Math]::Max($a.y,$b.y) -gt 0 }) })
     if ($add.Count -gt 0 -and $first.lines.Count -gt 0) { $m=[System.Collections.Generic.List[object]]::new(); $m.AddRange([object[]]@($first.lines)); $m.AddRange([object[]]$add); $ms=[Prep]::Score([string[]]@($m|ForEach-Object{$_.text}))
      if ($ms -gt $best.score+0.5) { $best=@{lines=$m;score=$ms;how="original+$($t[3])"} } }
    }
   }
  } finally { $nb.Dispose() }
 }
 $lines=$best.lines
 @{lines=@($lines.ToArray());width=$original.Width;height=$original.Height;pass=$best.how;ms=@($firstMs,$watch.ElapsedMilliseconds)} | ConvertTo-Json -Depth 8 -Compress
} finally { $original.Dispose() }
