import type {ComponentType} from "react";
export type Permission="profile.read"|"timeline.read"|"timeline.write"|"ai.invoke";
export type LifeEvent={id:string;type:string;source:string;occurredAt:string;data:Record<string,unknown>};
export type PluginContext={publish:(event:Omit<LifeEvent,"id"|"occurredAt"|"source">)=>void;readTimeline:()=>LifeEvent[];invokeAI:(messages:{role:"user"|"assistant";content:string}[])=>Promise<string>};
export type ZaituPlugin={id:string;name:string;tagline:string;description:string;icon:string;category:"health"|"growth"|"finance"|"leisure";accent:string;permissions:Permission[];Component:ComponentType<{context:PluginContext}>;onActivate?:(context:PluginContext)=>void|(()=>void)};
