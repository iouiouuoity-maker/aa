import {configured,getSession,logout,LOCAL_PREVIEW,endpoint} from './api.js';
export const $=(s,root=document)=>root.querySelector(s);
export function el(tag,attrs={},...children){const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(v==null||v===false)continue;if(k==='class')n.className=v;else if(k==='text')n.textContent=v;else if(k==='on')for(const[e,f]of Object.entries(v))n.addEventListener(e,f);else n.setAttribute(k,v===true?'':String(v));}for(const c of children.flat()){if(c!=null)n.append(c instanceof Node?c:document.createTextNode(String(c)));}return n;}
export function msg(target,text,type='info'){target.replaceChildren(el('div',{class:'message '+type,role:type==='error'?'alert':'status'},text));}
export function clear(target){target.replaceChildren();}
export function paragraphs(text){return String(text||'').split(/\n\s*\n/).map(t=>el('p',{},t));}
export function safeURL(value){if(!value)return null;if(/^assets\/images\/[a-z0-9-]+\.(webp|png|jpg)$/.test(value))return value;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function assetFor(m){return m.cover_file&&configured?endpoint('/api/files/'+encodeURIComponent(m.cover_file)):safeURL(m.cover_url)||'assets/images/intro.webp';}
export function setBusy(button,busy,label='Сохраняем…'){if(busy){button.dataset.label=button.textContent;button.textContent=label;}else button.textContent=button.dataset.label||button.textContent;button.disabled=busy;}
export const icons={home:'⌂',library:'▤',book:'▱',dialogue:'◌',practice:'✎',progress:'↗',about:'i',admin:'⚙'};
export function shell(page,title){
 const nav=[['home','index.html','Главная'],['library','library.html','Библиотека'],['book','book.html','Книга · 80 страниц'],['dialogue','dialogue.html','Диалог с героем'],['practice','practice.html','Мастерская'],['progress','progress.html','Мои работы']];
 const current=page==='material'?'library':page;
 const brand=el('a',{class:'brand',href:'index.html'},el('span',{class:'brand-mark','aria-hidden':'true'},'ж'),el('span',{},'живая книга',el('small',{},'Читать. Чувствовать. Понимать.')));
 const aside=el('aside',{class:'sidebar',id:'site-navigation'},brand,el('span',{class:'nav-caption'},'ПРОСТРАНСТВО ЧИТАТЕЛЯ'),el('nav',{'aria-label':'Основные разделы'},nav.map(([id,url,label])=>el('a',{href:url,class:'nav-link'+(current===id?' active':''),'aria-current':current===id?'page':null},el('span',{class:'nav-icon','aria-hidden':'true'},icons[id]),label))),el('div',{class:'sidebar-bottom'},el('a',{href:'about.html',class:'nav-link'+(page==='about'?' active':'')},'О проекте'),el('a',{href:'admin.html',class:'nav-link'+(page==='admin'?' active':'')},'Кабинет автора'),el('p',{class:'small muted'},'По рассказу Чингиза Айтматова «Солдатёнок»')));
 const toggle=el('button',{class:'menu-toggle','aria-label':'Открыть меню','aria-expanded':'false','aria-controls':'site-navigation'},'☰');
 const closeMenu=()=>{document.body.classList.remove('menu-open');toggle.setAttribute('aria-expanded','false');};
 toggle.addEventListener('click',()=>{const open=document.body.classList.toggle('menu-open');toggle.setAttribute('aria-expanded',String(open));if(open)aside.querySelector('a').focus();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();toggle.focus();}});
 const shade=el('button',{class:'nav-shade','aria-label':'Закрыть меню',tabindex:'-1',on:{click:closeMenu}});
 const session=getSession();
 const account=el('div',{class:'account'},el('span',{class:'small muted',id:'service-indicator'},configured?'Учебное пространство':'Гостевой просмотр'),session?el('a',{href:'progress.html',class:'account-name'},session.user.login):el('a',{href:'login.html',class:'button small-button secondary'},'Войти'));
 if(session){const out=el('button',{class:'text-button',on:{click:async()=>{try{await logout();location.href='index.html';}catch(e){alert(e.message+' Сессия не закрыта на сервере.');}}}},'Выйти');account.append(out);}
 const header=el('header',{class:'topbar'},el('div',{class:'breadcrumb'},'Живая книга',el('span',{'aria-hidden':'true'},'/'),title),account);
 const main=el('main',{id:'main',class:'main',tabindex:'-1'},header);
 document.body.prepend(el('a',{href:'#main',class:'skip-link'},'Перейти к содержанию'),toggle,shade,aside,main);
 if(LOCAL_PREVIEW)main.append(el('div',{class:'preview-note'},'Локальный просмотр. Общие действия проверяются на этом компьютере; генеративный AI здесь не подключён.'));
 const content=el('div',{class:'page-content'});main.append(content,el('footer',{class:'site-footer'},el('span',{},'Амангелді Айым Сұлтанқызы · Автор проекта и метода'),el('a',{href:'about.html#privacy'},'Данные и приватность')));
 return content;
}
export function pageHead(kicker,title,subtitle){return el('div',{class:'page-heading'},el('p',{class:'eyebrow'},kicker),el('h1',{},title),subtitle?el('p',{class:'lead muted'},subtitle):null);}
export function card(m){const image=el('img',{src:assetFor(m)||'assets/images/intro.webp',alt:'Иллюстрация к материалу «'+m.title+'»',loading:'lazy'});return el('article',{class:'material-card'},el('a',{href:'material.html?id='+encodeURIComponent(m.id),class:'card-image-link'},image),el('div',{class:'card-content'},el('span',{class:'pill'},m.category),el('h2',{},el('a',{href:'material.html?id='+encodeURIComponent(m.id)},m.title)),el('p',{class:'muted'},m.summary),el('a',{href:'material.html?id='+encodeURIComponent(m.id),class:'arrow-link'},'Открыть материал',el('span',{'aria-hidden':'true'},'↗'))));}
export function pager(target,page,total,size,onPage){target.replaceChildren();const count=Math.ceil(total/size);if(count<=1)return;target.append(el('button',{class:'button secondary',disabled:page<=1,on:{click:()=>onPage(page-1)}},'Назад'),el('span',{class:'muted'},`Страница ${page} из ${count}`),el('button',{class:'button secondary',disabled:page>=count,on:{click:()=>onPage(page+1)}},'Далее'));}
export function field(label,name,attrs={}){const {tag='input',...rest}=attrs;const input=el(tag,{id:name,name,...rest});return {wrap:el('label',{class:'field',for:name},el('span',{},label),input),input};}
