import {api,configured} from './api.js';
let bundled;
export async function initialMaterials(){return bundled||=(await fetch(new URL('./data/materials.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Материалы книги не загрузились.');return r.json();}));}
export async function catalog({q='',category='',page=1,admin=false}={}){
 if(configured)return api('/api/materials?'+new URLSearchParams({q,category,page,admin:admin?'1':'0'}));
 const all=await initialMaterials(),items=all.filter(m=>(!category||m.category===category)&&(!q||(m.title+' '+m.summary).toLowerCase().includes(q.toLowerCase())));return {items:items.slice((page-1)*9,page*9),total:items.length,page,pageSize:9,categories:[...new Set(all.map(m=>m.category))],offline:true};
}
export async function material(id,admin=false){if(configured)return (await api('/api/materials/'+encodeURIComponent(id)+(admin?'?admin=1':''))).material;return (await initialMaterials()).find(m=>m.id===id||m.slug===id)||null;}
export async function allPublished(){let page=1,out=[];for(;;){const r=await catalog({page});out.push(...r.items);if(out.length>=r.total)break;page++;}return out;}
