import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../cloudflare/worker.js';
import {LocalD1,MemoryR2} from '../tools/d1-adapter.mjs';
const origin='https://example.github.io',secret=crypto.randomUUID();
async function fresh(){const DB=new LocalD1();DB.exec(await readFile(new URL('../cloudflare/schema.sql',import.meta.url),'utf8'));DB.exec(await readFile(new URL('../cloudflare/seed.sql',import.meta.url),'utf8'));return {DB,FILES:new MemoryR2(),ALLOWED_ORIGIN:origin,BOOTSTRAP_SECRET:secret,AI_DAILY_LIMIT:'60'};}
async function call(env,path,{method='GET',body,token,customOrigin=origin,ip='127.0.0.1',headers:extra={}}={}){const headers={'Origin':customOrigin,'CF-Connecting-IP':ip,...extra};if(token)headers.Authorization='Bearer '+token;if(body!==undefined&&!(body instanceof FormData))headers['Content-Type']='application/json';const response=await worker.fetch(new Request('https://worker.example'+path,{method,headers,...(body!==undefined?{body:body instanceof FormData?body:JSON.stringify(body)}:{})}),env);return {response,status:response.status,data:response.headers.get('Content-Type')?.includes('application/json')?await response.json():await response.arrayBuffer()};}
async function owner(env){const r=await call(env,'/api/setup',{method:'POST',body:{login:'owner-01',password:'a-long-secret-password-01',secret}});assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
const value={slug:'novyy-material',title:'Новая читательская работа',summary:'Содержательное описание нового учебного материала.',category:'Новая категория',body:'Это новый учебный текст о внимательном чтении. Его можно редактировать и публиковать через кабинет.',context:'Новый проверенный контекст для генеративной модели.',cover_url:'',attachment_url:'',video_url:'',tasks:[{id:'q-1',type:'open',prompt:'Объясни значение выбранного эпизода.',criteria:'Точность и текстовая опора',options:[]}],status:'draft'};
test('Server auth, roles, CMS lifecycle, conflict detection, student privacy, review, expiry and logout',async()=>{
 const env=await fresh(),admin=await owner(env);
 assert.equal((await call(env,'/api/setup',{method:'POST',body:{login:'other-01',password:'a-long-secret-password-02',secret}})).status,409);
 assert.equal((await call(env,'/api/materials',{method:'POST',body:value})).status,401);
 const a=await call(env,'/api/register',{method:'POST',body:{login:'reader-01',password:'reader-password-1234',role:'admin'}}),b=await call(env,'/api/register',{method:'POST',body:{login:'reader-02',password:'reader-password-5678'}});assert.equal(a.status,200);assert.equal(a.data.user.role,'student');
 const stored=await env.DB.prepare('SELECT password_hash FROM users WHERE id=?').bind(a.data.user.id).first();assert.match(stored.password_hash,/^pbkdf2-sha256\$100000\$/);assert.ok(!stored.password_hash.includes('reader-password'));
 assert.equal((await call(env,'/api/materials',{method:'POST',body:value,token:a.data.token})).status,403);
 const created=await call(env,'/api/materials',{method:'POST',body:value,token:admin.token});assert.equal(created.status,200);const m=created.data.material;
 assert.equal((await call(env,'/api/materials/'+m.id)).status,401);
 assert.ok(!(await call(env,'/api/materials')).data.items.some(x=>x.id===m.id));
 const edit=await call(env,'/api/materials/'+m.id,{method:'PUT',token:admin.token,body:{...m,status:'published'}});assert.equal(edit.status,200);
 assert.equal((await call(env,'/api/materials/'+m.id,{method:'PUT',token:admin.token,body:{...m,status:'published'}})).status,409);
 const search=await call(env,'/api/materials?q=Новая&category='+encodeURIComponent('Новая категория'));assert.equal(search.data.total,1);
 const published=(await call(env,'/api/materials/'+m.id)).data.material;assert.equal(published.tasks.length,1);assert.ok(!('context'in published));
 const sent=await call(env,'/api/submissions',{method:'POST',token:a.data.token,body:{materialId:m.id,answers:{'q-1':'Мой самостоятельный ответ с опорой на выбранный эпизод.'}}});assert.equal(sent.status,200);
 assert.equal((await call(env,'/api/submissions',{token:b.data.token})).data.total,0);assert.equal((await call(env,'/api/submissions?review=1',{token:a.data.token})).status,403);
 const own=(await call(env,'/api/submissions',{token:a.data.token})).data.items[0];assert.equal(own.status,'submitted');
 const graded=await call(env,'/api/submissions/'+own.id,{method:'PUT',token:admin.token,body:{score:8,feedback:'Есть точная опора; объясни связь подробнее.',revision:own.revision}});assert.equal(graded.status,200);
 const reread=(await call(env,'/api/submissions',{token:a.data.token})).data.items[0];assert.equal(reread.score,8);assert.match(reread.feedback,/точная/);
 assert.equal((await call(env,'/api/submissions/'+own.id,{method:'PUT',token:admin.token,body:{score:4,feedback:'stale',revision:own.revision}})).status,409);
 const updated=edit.data.material;assert.equal((await call(env,'/api/materials/'+m.id,{method:'PUT',token:admin.token,body:{...updated,status:'archived'}})).status,200);
 assert.equal((await call(env,'/api/materials?q=Новая')).data.total,0);
 await call(env,'/api/logout',{method:'POST',token:a.data.token});assert.equal((await call(env,'/api/me',{token:a.data.token})).status,401);
 await env.DB.prepare('UPDATE sessions SET expires_at=0 WHERE user_id=?').bind(b.data.user.id).run();assert.equal((await call(env,'/api/me',{token:b.data.token})).status,401);
 env.DB.close();
});
test('Input validation, exact CORS, SQL parameters, permission to create staff, login throttling',async()=>{
 const env=await fresh(),admin=await owner(env);
 assert.equal((await call(env,'/api/status',{customOrigin:'https://evil.example'})).status,403);
 const cors=await call(env,'/api/status');assert.equal(cors.response.headers.get('Access-Control-Allow-Origin'),origin);
 assert.equal((await call(env,'/api/materials',{method:'POST',token:admin.token,body:{...value,cover_url:'javascript:alert(1)'}})).status,400);
 assert.equal((await call(env,'/api/register',{method:'POST',body:{login:"x' OR 1=1--",password:'long-enough-password'}})).status,400);
 assert.equal((await call(env,'/api/materials?q='+encodeURIComponent("%' OR 1=1--"))).status,200);
 const teacher=await call(env,'/api/users',{method:'POST',token:admin.token,body:{login:'teacher-01',password:'teacher-password-1234',role:'teacher'}});assert.equal(teacher.status,200);
 const login=await call(env,'/api/login',{method:'POST',body:{login:'teacher-01',password:'teacher-password-1234'}});assert.equal(login.status,200);
 assert.equal((await call(env,'/api/users',{method:'POST',token:login.data.token,body:{login:'teacher-02',password:'teacher-password-1234',role:'admin'}})).status,403);
 let last;for(let i=0;i<11;i++)last=await call(env,'/api/login',{method:'POST',ip:'10.0.0.2',body:{login:'nonexistent-01',password:'wrong-password-1234'}});assert.equal(last.status,429);
 env.DB.close();
});
test('AI binding: no fallback, new material context, response and quota errors (model stub, NOT live AI)',async()=>{
 const env=await fresh();
 const off=await call(env,'/api/ai',{method:'POST',body:{materialId:'chitayu',mode:'Авалбек',question:'Как понять этот эпизод?'}});assert.equal(off.status,503);assert.equal(off.data.code,'ai_unavailable');
 let received;env.AI={async run(model,input){received={model,input};return {response:'TEST STUB — transport verification only'};}};
 const r=await call(env,'/api/ai',{method:'POST',ip:'2.2.2.2',body:{materialId:'chitayu',mode:'Авалбек',question:'Почему герой поверил?',draft:'Учебный черновик'}});assert.equal(r.status,200);assert.equal(received.model,'@cf/meta/llama-3.3-70b-instruct-fp8-fast');assert.match(received.input.messages[0].content,/Токтосуна/);assert.match(received.input.messages[1].content,/Учебный черновик/);
 const admin=await owner(env),m=(await call(env,'/api/materials',{method:'POST',token:admin.token,body:{...value,status:'published'}})).data.material;
 await call(env,'/api/ai',{method:'POST',ip:'3.3.3.3',body:{materialId:m.id,question:'Что говорится в новом материале?'}});assert.match(received.input.messages[0].content,/Новый проверенный контекст/);
 env.AI={async run(){throw Error('quota limit 429');}};const quota=await call(env,'/api/ai',{method:'POST',ip:'4.4.4.4',body:{materialId:'chitayu',question:'Дай подсказку по эпизоду.'}});assert.equal(quota.status,429);assert.equal(quota.data.code,'ai_quota');
 env.AI={async run(){return {response:''};}};assert.equal((await call(env,'/api/ai',{method:'POST',ip:'5.5.5.5',body:{materialId:'chitayu',question:'Как найти точную деталь?'}})).status,502);
 env.DB.close();
});
test('R2 upload: file type and size, private draft file, public published attachment',async()=>{
 const env=await fresh(),admin=await owner(env),form=new FormData();form.append('file',new File(['<script>alert(1)</script>'],'evil.jpg',{type:'image/jpeg'}));
 assert.equal((await call(env,'/api/uploads',{method:'POST',token:admin.token,body:form,headers:{'Content-Length':'300'}})).status,415);
 assert.equal((await call(env,'/api/uploads',{method:'POST',token:admin.token,body:form,headers:{'Content-Length':String(12*1024*1024)}})).status,413);
 const pdf=new FormData();pdf.append('file',new File(['%PDF-1.4\n% test fixture'],'reader.pdf',{type:'application/pdf'}));const up=await call(env,'/api/uploads',{method:'POST',token:admin.token,body:pdf,headers:{'Content-Length':'300'}});assert.equal(up.status,200);
 assert.equal((await call(env,'/api/files/'+up.data.file.id)).status,401);
 const created=await call(env,'/api/materials',{method:'POST',token:admin.token,body:{...value,status:'published',attachment_file:up.data.file.id}});assert.equal(created.status,200);
 assert.equal((await call(env,'/api/files/'+up.data.file.id)).status,200);
 env.DB.close();
});

test('Pagination and Cyrillic long answers follow the advertised limits',async()=>{
 const env=await fresh(),admin=await owner(env);
 for(let i=0;i<3;i++)assert.equal((await call(env,'/api/materials',{method:'POST',token:admin.token,body:{...value,slug:'pagination-'+i,status:'published'}})).status,200);
 const first=(await call(env,'/api/materials')).data,second=(await call(env,'/api/materials?page=2')).data;assert.equal(first.items.length,9);assert.equal(second.items.length,9);assert.equal(first.total,69);assert.ok(!second.items.some(m=>first.items.some(n=>n.id===m.id)));
 const tasks=Array.from({length:10},(_,i)=>({id:'long-'+i,type:'open',prompt:'Объясните деталь эпизода.',criteria:'',options:[]}));
 const m=(await call(env,'/api/materials',{method:'POST',token:admin.token,body:{...value,slug:'long-answers',status:'published',tasks}})).data.material;
 const answers=Object.fromEntries(tasks.map(t=>[t.id,'я'.repeat(2500)]));
 assert.equal((await call(env,'/api/submissions',{method:'POST',token:admin.token,body:{materialId:m.id,answers}})).status,200);
 env.DB.close();
});
