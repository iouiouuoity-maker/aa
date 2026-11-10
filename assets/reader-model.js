export const clean = s=>String(s??'').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'');
export const norm=s=>String(s??'').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim();
const synonyms={мама:['мать','джеенгуль'],мать:['джеенгуль','матери'],папа:['отец','токтосун'],отец:['отца','токтосун'],мальчик:['авалбек'],чувства:['переживания','эмоции'],кино:['фильм','кинопоказ'],доказательство:['аргумент','довод','опора'],ии:['ai','цифровой'],вопросы:['вопрос'],война:['войне','военный']};
export function searchItems(items,query,type='Все'){
 const ignored=new Set(['почему','как','что','зачем','кто','где','когда','какой','какая','какое','такое','это','ли','и','в','на','по','о','об','для','мне','найти','помоги','расскажи']);
 const words=norm(query).split(' ').filter(w=>w&&!ignored.has(w));if(!words.length)return [];
 const groups=words.map(w=>[w,...(synonyms[w]||[])]);
 return items.filter(x=>type==='Все'||x.type===type).map(x=>{
  const title=norm(x.title),body=norm(x.text),groupsHit=groups.map(g=>g.some(w=>title.includes(w)||body.includes(w)||(w.length>5&&(title+' '+body).includes(w.slice(0,-2)))));
  const score=groupsHit.filter(Boolean).length*10+groups.reduce((n,g)=>n+g.filter(w=>title.includes(w)).length*5,0)+(title.includes(norm(query))?20:0);
  return {...x,score:groupsHit.every(Boolean)?score:0};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title,'ru'));
}
export function blockText(b){return b.text?clean(b.text):Array.isArray(b.items)?b.items.map(x=>Array.isArray(x)?x.map(clean).join(': '):clean(x)).join('\n'):'';}
export function buildIndex(materials,book,tasks,portal){return [
 ...materials.map(m=>({id:'m-'+m.id,title:m.title,text:m.summary+' '+m.body,type:'Разборы',url:'material.html?id='+encodeURIComponent(m.id),label:m.category})),
 ...book.pages.map((p,i)=>({id:'b-'+i,title:p.title||'Обложка книги',text:[p.section,...(p.blocks||[]).map(blockText)].join(' '),type:'Книга',url:'book.html?page='+(i+1),label:'Страница '+(i+1)})),
 ...tasks.map(t=>({id:t.id,title:'Задание '+t.number+' · '+t.title,text:t.prompt,type:'Задания',url:'practice.html?task='+t.id,label:t.topic})),
 ...portal.terms.map(t=>({id:t.id,title:t.term,text:t.definition+' '+t.example,type:'Словарь',url:'glossary.html?term='+t.id,label:'Термин'})),
 ...portal.heroes.map(h=>({id:h.id,title:h.name,text:[h.role,...h.facts,h.arc,h.question].join(' '),type:'Герои',url:'heroes.html?id='+h.id,label:h.role})),
 ...portal.timeline.map(t=>({id:t.id,title:t.title,text:t.text+' '+t.question,type:'События',url:'timeline.html?id='+t.id,label:t.stage}))];}
export function filterMaterials(all,{q='',category='',kind='',sort='recommended',saved=null}={}){
 let list=all.filter(m=>(!category||m.category===category)&&(!kind||(m.kind||'Разбор')===kind)&&(!saved||saved.includes(m.id)));
 if(q){const ids=new Set(searchItems(list.map(m=>({id:m.id,title:m.title,text:m.summary+' '+m.body,type:'Разборы'})),q).map(m=>m.id));list=list.filter(m=>ids.has(m.id));}
 if(sort==='az')list.sort((a,b)=>a.title.localeCompare(b.title,'ru'));if(sort==='short')list.sort((a,b)=>(a.minutes||5)-(b.minutes||5));return list;
}
export const emptyState=()=>({version:3,favorites:[],read:[],notes:{},answers:{},checks:{},known:[],results:[],essay:{},compare:{}});
export function validateState(value){
 if(!value||value.version!==3||typeof value!=='object')throw Error('Это не файл записей «Живой книги» версии 3.');
 const out=emptyState(),safeKey=k=>/^[a-zA-Z0-9-]{1,100}$/.test(k);
 for(const k of ['favorites','read','known']){if(value[k]!==undefined&&!Array.isArray(value[k]))throw Error('Повреждён список записей.');out[k]=[...new Set((value[k]||[]).filter(x=>typeof x==='string'&&safeKey(x)))].slice(0,2000);}
 for(const key of ['notes','answers','essay','compare']){const obj=value[key]||{};if(typeof obj!=='object'||Array.isArray(obj))throw Error('Неверный формат заметок.');for(const [k,v] of Object.entries(obj).slice(0,2000))if(safeKey(k)&&typeof v==='string')out[key][k]=v.slice(0,key==='notes'?20000:12000);}
 for(const [k,v]of Object.entries(value.checks||{}))if(safeKey(k)&&Array.isArray(v))out.checks[k]=v.slice(0,10).map(Boolean);
 out.results=(Array.isArray(value.results)?value.results:[]).filter(r=>Number.isInteger(r.score)&&Number.isInteger(r.total)&&r.total>0&&r.score>=0&&r.score<=r.total&&Number.isFinite(r.date)).slice(-50).map(({score,total,date})=>({score,total,date}));return out;
}
