import {createServer} from "node:http";import {config} from "dotenv";import {resolve} from "node:path";
config({path:resolve(process.cwd(),".env")});
const PORT=Number(process.env.API_PORT||8787);const base=(process.env.DEEPSEEK_BASE_URL||"https://api.deepseek.com").replace(/\/$/,"");
const send=(res:any,status:number,data:unknown)=>{res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(data));};
createServer(async(req,res)=>{if(req.url==="/api/health"&&req.method==="GET")return send(res,200,{ok:true,aiConfigured:!!process.env.DEEPSEEK_API_KEY});
if(req.url!=="/api/chat"||req.method!=="POST")return send(res,404,{error:"Not found"});
if(!process.env.DEEPSEEK_API_KEY)return send(res,503,{error:"Configure DEEPSEEK_API_KEY in root .env"});
const chunks:Buffer[]=[];for await(const chunk of req){chunks.push(Buffer.from(chunk));if(Buffer.concat(chunks).length>24_000)return send(res,413,{error:"Request too large"});}
try{const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));if(!Array.isArray(body.messages)||body.messages.length>24||body.messages.some((m:any)=>!["user","assistant"].includes(m.role)||typeof m.content!=="string"||m.content.length>5000))return send(res,400,{error:"Invalid messages"});
const response=await fetch(base+"/chat/completions",{method:"POST",headers:{"Authorization":`Bearer ${process.env.DEEPSEEK_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.DEEPSEEK_MODEL||"deepseek-chat",messages:[{role:"system",content:"你是在途 AI 生活助手。提供温暖、简洁、可执行的帮助；涉及医疗与投资时说明不确定性，不提供确定性诊断或收益承诺。"},...body.messages],stream:false}),signal:AbortSignal.timeout(30000)});
const data=await response.json();if(!response.ok)return send(res,502,{error:"AI provider request failed",status:response.status});return send(res,200,{message:data?.choices?.[0]?.message?.content||""});}catch{return send(res,500,{error:"Unable to complete request"});}
}).listen(PORT,()=>console.log(`ZAITU API listening at http://localhost:${PORT}`));
