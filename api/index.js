export default function handler(q,r){
r.setHeader('Access-Control-Allow-Origin','*');
r.setHeader('Content-Type','application/json');
r.end(JSON.stringify({success:true,pin:'V0',value:'24.8',title:'OK',insights:'Nominal',actions:[],data:[]}));
}
