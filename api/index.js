const s=new Map([['V0','24.8'],['V1','58.5'],['V2','0'],['V3','128'],['V4','3.82']]);
export default function handler(q,r){
r.setHeader('Access-Control-Allow-Origin','*');
if(q.method==='OPTIONS')return r.end();
const u=new URL(q.url,'http://x'),p=u.pathname,v=Object.fromEntries(u.searchParams);

if(p.includes('update')){
if(v.pin)s.set(v.pin.toUpperCase(),String(v.value||'0'));
r.end(JSON.stringify({success:true}));
}else if(p.includes('get')){
r.end(s.get((v.pin||'V0').toUpperCase())||'0');
}else if(p.includes('query')){
r.end(JSON.stringify({title:'OK',insights:'V0:'+s.get('V0'),actions:[],data:[]}));
}else{r.statusCode=404;r.end('Not Found');}
}
