"use client";

type Row = Record<string, any>;
const STORAGE_KEY = "november-command-centre-local-v1";
const USER_ID = "local-device-user";

function readStore(): Record<string, Row[]> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function writeStore(store: Record<string, Row[]>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}
class Query {
  table: string; action = "select"; payload: any; filters: Array<[string, any]> = [];
  sort: {column:string;ascending:boolean}|null = null; max: number|null = null; wantsSingle = false;
  constructor(table:string){this.table=table;}
  select(_columns="*"){return this;}
  insert(value: Row|Row[]){this.action="insert";this.payload=value;return this;}
  upsert(value: Row|Row[]){this.action="upsert";this.payload=value;return this;}
  update(value: Row){this.action="update";this.payload=value;return this;}
  delete(){this.action="delete";return this;}
  eq(column:string,value:any){this.filters.push([column,value]);return this;}
  order(column:string,opts?:{ascending?:boolean}){this.sort={column,ascending:opts?.ascending!==false};return this;}
  limit(n:number){this.max=n;return this;}
  maybeSingle(){this.wantsSingle=true;return this.run();}
  single(){this.wantsSingle=true;return this.run();}
  then(resolve:any,reject:any){return this.run().then(resolve,reject);}
  async run():Promise<any>{
    const store=readStore(); let rows=store[this.table]||[];
    const matches=(r:Row)=>this.filters.every(([k,v])=>r[k]===v);
    let result:Row[]=[];
    if(this.action==="insert"||this.action==="upsert"){
      const items=(Array.isArray(this.payload)?this.payload:[this.payload]).map((x:Row)=>({...x,id:x.id||crypto.randomUUID(),created_at:x.created_at||new Date().toISOString()}));
      for(const item of items){const i=rows.findIndex(x=>x.id===item.id);if(i>=0)rows[i]={...rows[i],...item};else rows.push(item);}
      result=items;
    } else if(this.action==="update"){
      rows=rows.map(x=>{if(matches(x)){const next={...x,...this.payload};result.push(next);return next;}return x;});
    } else if(this.action==="delete"){
      result=rows.filter(matches);rows=rows.filter(x=>!matches(x));
    } else result=rows.filter(matches);
    store[this.table]=rows;
    if(this.action!=="select")writeStore(store);
    if(this.sort){const {column,ascending}=this.sort;result.sort((a,b)=>{const av=a[column]??"",bv=b[column]??"";return (av>bv?1:av<bv?-1:0)*(ascending?1:-1);});}
    if(this.max!==null)result=result.slice(0,this.max);
    return {data:this.wantsSingle?(result[0]||null):result,error:null};
  }
}
export const isSupabaseConfigured = true;
export const supabase:any = {
  auth:{
    getSession:async()=>({data:{session:{user:{id:USER_ID}}},error:null}),
    signInAnonymously:async()=>({data:{user:{id:USER_ID}},error:null}),
    signOut:async()=>({error:null})
  },
  from:(table:string)=>new Query(table),
  storage:{from:(_bucket:string)=>({
    upload:async()=>({data:null,error:null}),
    createSignedUrl:async()=>({data:{signedUrl:""},error:null}),
    remove:async()=>({data:[],error:null})
  })}
};
