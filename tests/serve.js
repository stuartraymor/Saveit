// Serves the test harness folder on 127.0.0.1 with caching turned off, so every reload gets the newest files.
// node tests/serve.js <folder> [port]
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(process.argv[2]||'harness'),port=+process.argv[3]||8765;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.ico':'image/x-icon','.json':'application/json','.svg':'image/svg+xml','.wasm':'application/wasm'};
http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname);if(p==='/')p='/index.html';const f=path.join(root,path.normalize(p));
  if(!f.startsWith(root)){res.writeHead(403);res.end();return}
  fs.readFile(f,(err,data)=>{if(err){res.writeHead(404);res.end('not found');return}res.writeHead(200,{'Content-Type':TYPES[path.extname(f).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});res.end(data)})
}).listen(port,'127.0.0.1',()=>console.log('serving',root,'on http://127.0.0.1:'+port));
