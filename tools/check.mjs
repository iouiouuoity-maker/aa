import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');let count=0;
async function walk(dir){for(const n of await readdir(dir)){const p=resolve(dir,n);if((await stat(p)).isDirectory())await walk(p);else if(/\.(mjs|js)$/.test(n)){const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});if(r.status)throw Error(r.stderr);count++;}}}
await walk(resolve(root,'docs/assets'));await walk(resolve(root,'cloudflare'));await walk(resolve(root,'tools'));await walk(resolve(root,'tests'));
const pages=(await readdir(resolve(root,'docs'))).filter(n=>n.endsWith('.html'));
for(const name of pages){const html=await readFile(resolve(root,'docs',name),'utf8');for(const match of html.matchAll(/(?:src|href)="([^"#?]+)[^"\s]*"/g)){const ref=match[1];if(/^(https?:|data:|mailto:)/.test(ref))continue;await stat(resolve(root,'docs',ref));}}
const book=JSON.parse(await readFile(resolve(root,'docs/assets/data/book.json'),'utf8'));
console.log('Syntax OK:',count,'files. HTML local references OK:',pages.length,'pages. Book loaded:',Array.isArray(book)?book.length:Object.keys(book));
