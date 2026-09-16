import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const mime={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.mjs':'text/plain; charset=utf-8','.png':'image/png','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');const pathname=decodeURIComponent(url.pathname);
 if(!/^\/(outputs\/gray[^/]*|experiments\/gray-rules-20260916)\//u.test(pathname))throw new Error('not allowed');
 const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep))throw new Error('outside root');
 const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}}).listen(8879,'127.0.0.1',()=>console.log('http://127.0.0.1:8879/outputs/gray-rules-report-20260916/index.html'));
