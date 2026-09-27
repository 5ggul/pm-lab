import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../output/community-preview/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.woff2':'font/woff2'};
http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.writeHead(302,{Location:'/community/'}).end();return;}let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(path.resolve(root)+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');if(!fs.existsSync(file)){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});fs.createReadStream(file).pipe(res);}catch{res.writeHead(400).end();}}).listen(4190,'127.0.0.1',()=>console.log('http://127.0.0.1:4190/community/'));
