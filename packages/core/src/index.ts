import type{LifeEvent,ZaituPlugin,PluginContext}from"@zaitu/plugin-sdk";
const EVENTS_KEY="zaitu.timeline.v1";const ENABLED_KEY="zaitu.enabled.v1";
const read=<T,>(key:string,fallback:T):T=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}};
export const readEvents=():LifeEvent[]=>read(EVENTS_KEY,[]);
export const readEnabled=():Record<string,boolean>=>read(ENABLED_KEY,{});
export const setEnabled=(id:string,enabled:boolean)=>localStorage.setItem(ENABLED_KEY,JSON.stringify({...readEnabled(),[id]:enabled}));
export const makeContext=(plugin:ZaituPlugin,onChange:()=>void):PluginContext=>({
 publish:event=>{if(!plugin.permissions.includes("timeline.write"))throw Error("Permission denied");const items=readEvents();items.unshift({...event,id:crypto.randomUUID(),occurredAt:new Date().toISOString(),source:plugin.id});localStorage.setItem(EVENTS_KEY,JSON.stringify(items.slice(0,500)));onChange()},
 readTimeline:()=>{if(!plugin.permissions.includes("timeline.read"))throw Error("Permission denied");return readEvents()},
 invokeAI:async messages=>{if(!plugin.permissions.includes("ai.invoke"))throw Error("Permission denied");const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages})});const body=await response.json();if(!response.ok)throw Error(body.error||"AI is unavailable");return body.message}
});
export const registerPlugins=(plugins:ZaituPlugin[])=>{const ids=new Set<string>();for(const p of plugins){if(ids.has(p.id))throw Error("Duplicate plugin: "+p.id);ids.add(p.id)}return plugins};
