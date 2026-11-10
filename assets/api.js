import { AI_API_URL, LOCAL_PREVIEW } from './config.js';
export const configured = Boolean(AI_API_URL);
export { LOCAL_PREVIEW };
export class ApiError extends Error {constructor(message,status=0,code='network'){super(message);this.status=status;this.code=code;}}
const key='zhivaya-kniga-session';
export function getSession(){try{const s=JSON.parse(sessionStorage.getItem(key)||'null');if(s&&s.expiresAt*1000>Date.now())return s;sessionStorage.removeItem(key);}catch{}return null;}
export function setSession(s){sessionStorage.setItem(key,JSON.stringify(s));}
export function forgetSession(){sessionStorage.removeItem(key);}
export function endpoint(path){if(!configured)throw new ApiError('Общий сервис пока недоступен. Материалы книги можно читать без входа.',503,'not_configured');return AI_API_URL.replace(/\/$/,'')+path;}
export async function api(path,{method='GET',body,signal}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
 try{
  const headers={},session=getSession();if(session)headers.Authorization='Bearer '+session.token;
  if(body!==undefined&&!(body instanceof FormData))headers['Content-Type']='application/json';
  const res=await fetch(endpoint(path),{method,headers,body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body),signal:controller.signal,cache:'no-store',credentials:'omit'});
  const data=await res.json().catch(()=>({error:'Не удалось прочитать ответ сервера.'}));
  if(!res.ok){if(res.status===401)forgetSession();throw new ApiError(data.error||'Запрос не выполнен.',res.status,data.code);}
  return data;
 }catch(e){if(e instanceof ApiError)throw e;throw new ApiError(e.name==='AbortError'?'Время ожидания истекло. Проверьте соединение и повторите попытку.':'Сервис недоступен. Проверьте соединение и попробуйте снова.');}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export async function askAI({materialId,question,mode='Наставник',draft=''}){return api('/api/ai',{method:'POST',body:{materialId,question,mode,draft}});}
export async function logout(){await api('/api/logout',{method:'POST'});forgetSession();}
export async function fileBlob(fileId){const headers={};const s=getSession();if(s)headers.Authorization='Bearer '+s.token;const r=await fetch(endpoint('/api/files/'+encodeURIComponent(fileId)),{headers});if(!r.ok)throw new ApiError('Не удалось открыть файл.',r.status);return r.blob();}
