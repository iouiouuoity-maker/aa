import {DatabaseSync} from 'node:sqlite';
// Local/test adapter only. Production code uses env.DB supplied by Cloudflare D1.
export class LocalD1 {
 constructor(path=':memory:'){this.sqlite=new DatabaseSync(path);this.sqlite.exec('PRAGMA foreign_keys=ON;');}
 exec(sql){this.sqlite.exec(sql);}
 prepare(sql){const db=this;let values=[];return {bind(...args){values=args;return this;},async first(column){const row=db.sqlite.prepare(sql).get(...values);return row?(column?row[column]:row):null;},async all(){return {success:true,results:db.sqlite.prepare(sql).all(...values)};},async run(){const result=db.sqlite.prepare(sql).run(...values);return {success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};}};}
 async batch(statements){this.sqlite.exec('BEGIN IMMEDIATE');try{const results=[];for(const s of statements)results.push(await s.run());this.sqlite.exec('COMMIT');return results;}catch(e){this.sqlite.exec('ROLLBACK');throw e;}}
 close(){this.sqlite.close();}
}
export class MemoryR2 {
 constructor(){this.files=new Map();}
 async put(key,data,options){this.files.set(key,{data:new Uint8Array(data),options});}
 async get(key){const f=this.files.get(key);return f?{body:f.data}:null;}
 async delete(key){this.files.delete(key);}
}
