import http from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,dirname,extname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import worker from '../cloudflare/worker.js';
import {LocalD1} from './d1-adapter.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),port=Number(process.env.PORT)||4173;
const host='127.0.0.1',origin=`http://${host}:${port}`;
const base='/'+(process.env.BASE_PATH||'').replace(/^\/+|\/+$/g,'')+(process.env.BASE_PATH?'/':'');
const state=join(root,'.dev',process.env.DEV_STORE||'');await mkdir(join(state,'uploads'),{recursive:true});
const db=new LocalD1(join(state,'library.sqlite'));db.exec(await readFile(join(root,'cloudflare/schema.sql'),'utf8'));db.exec(await readFile(join(root,'cloudflare/seed.sql'),'utf8'));
let secret;try{secret=await readFile(join(state,'setup-secret.txt'),'utf8');}catch{secret=crypto.randomUUID()+crypto.randomUUID();await writeFile(join(state,'setup-secret.txt'),secret,{mode:0o600});}
const FILES={async put(key,data){await writeFile(join(state,'uploads',key.split('/').at(-1)),new Uint8Array(data));},async get(key){try{return {body:await readFile(join(state,'uploads',key.split('/').at(-1)))};}catch{return null;}},async delete(key){const {unlink}=await import('node:fs/promises');await unlink(join(state,'uploads',key.split('/').at(-1))).catch(()=>{});}};
const env={DB:db,FILES,ALLOWED_ORIGIN:origin,BOOTSTRAP_SECRET:secret,RATE_LIMIT_SALT:secret,AI_DAILY_LIMIT:'60'};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.pdf':'application/pdf'};
const server=http.createServer(async(req,res)=>{
 try{const url=new URL(req.url,origin);if(url.pathname.startsWith('/api/')){
  const buffers=[];let size=0;for await(const part of req){size+=part.length;if(size>11*1024*1024){res.writeHead(413);res.end();return;}buffers.push(part);}
  const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(buffers)}:{})});
  const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
 }
 if(!url.pathname.startsWith(base)){res.writeHead(302,{Location:base+'index.html'});res.end();return;}
 const relative=decodeURIComponent(url.pathname.slice(base.length))||'index.html';
 if(relative==='assets/config.js'){
  res.writeHead(200,{'Content-Type':types['.js'],'Cache-Control':'no-store'});res.end(`export const AI_API_URL = ${JSON.stringify(origin)}; export const LOCAL_PREVIEW = true;`);return;
 }
 const file=resolve(root,'docs',relative),dir=resolve(root,'docs');if(!file.startsWith(dir+'/')){res.writeHead(403);res.end();return;}
 const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Страница не найдена.');}
});
server.listen(port,host,()=>{console.log(`Local preview: ${origin}${base}index.html`);console.log(`Local database: ${state}/library.sqlite. Real AI is NOT connected.`);console.log(`Owner setup code file: ${state}/setup-secret.txt (local only; never included in the ZIP).`);});
process.on('SIGTERM',()=>server.close(()=>{db.close();process.exit(0);}));
