import {emptyState,validateState} from './reader-model.js';
const KEY='zhivaya-kniga-reader-v3';let data;let storageWarning='';
try{data=validateState(JSON.parse(localStorage.getItem(KEY)||JSON.stringify(emptyState())));}catch{data=emptyState();storageWarning='Не удалось прочитать прежние записи. Сохранение может быть ограничено настройками браузера.';}
export const state=()=>data;
export const warning=()=>storageWarning;
export function save(change){const next=structuredClone(data);change(next);const valid=validateState(next);try{localStorage.setItem(KEY,JSON.stringify(valid));}catch{throw Error('Браузер не сохранил запись. Скачайте её текст или экспортируйте записи.');}data=valid;window.dispatchEvent(new Event('reader-saved'));return data;}
export function importState(value){const valid=validateState(value);localStorage.setItem(KEY,JSON.stringify(valid));data=valid;window.dispatchEvent(new Event('reader-saved'));}
export function toggle(key,id){return save(s=>{s[key]=s[key].includes(id)?s[key].filter(x=>x!==id):[...s[key],id];});}
export function download(name,text,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
