import { useId, useState } from "react";
import type { PluginContext, ZaituPlugin } from "@zaitu/plugin-sdk";
import { IDEAS, pickNext } from "./model";
import { modules } from "./modules";
import "./style.css";

function View({ context }: { context: PluginContext }) {
  const id = useId();
  const [idea, setIdea] = useState<(typeof IDEAS)[number]>(IDEAS[0]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = modules.find(module => module.id === activeId);
  const Tool = active?.Component;

  return <div className="leisure-view stack">
    <header>
      <p className="eyebrow">摸鱼湾 · LEISURE</p>
      <h2>偶尔停靠，也是一种前进</h2>
      <p className="muted">把忙碌留在岸边，给自己一点不赶时间的空隙。</p>
    </header>
    <section className="card leisure-draw stack" aria-labelledby={`${id}-draw`}>
      <div className="row"><span className="pill">此刻的小补给</span><span className="muted">不必完成任务，只需照顾自己</span></div>
      <div className="leisure-idea" aria-live="polite" aria-atomic="true">
        <span className="leisure-icon" aria-hidden="true">{idea.icon}</span>
        <h3 id={`${id}-draw`}>{idea.title}</h3>
        <p className="muted">{idea.description}</p>
        <span className="pill">{idea.duration}</span>
      </div>
      <div className="row leisure-center">
        <button className="btn" type="button"
          onClick={() => setIdea(current => pickNext(IDEAS, current))}>换一张放松签</button>
      </div>
    </section>
    <section className="stack" aria-labelledby={`${id}-tools`}>
      <div><h3 id={`${id}-tools`}>岸边的小工具</h3><p className="muted">选一种轻松的方式，短暂停留。</p></div>
      <div className="leisure-tools">
        {modules.map(module => <article className="card stack" key={module.id}>
          <div className="row"><span aria-hidden="true">{module.icon}</span><h4>{module.name}</h4></div>
          <p className="muted">{module.description}</p>
          <button className={`btn${activeId === module.id ? "" : " secondary"}`} type="button"
            aria-expanded={activeId === module.id} aria-controls={`${id}-workspace`}
            onClick={() => setActiveId(current => current === module.id ? null : module.id)}>
            {activeId === module.id ? `收起${module.name}` : `打开${module.name}`}
          </button>
        </article>)}
      </div>
      <div id={`${id}-workspace`}>
        {active && Tool ? <section className="card stack" aria-label={active.name}>
          <h3>{active.name}</h3>
          <Tool key={active.id} context={context} />
        </section> : <p className="notice">选择上方工具即可开始。切换或收起工具会结束本次使用。</p>}
      </div>
    </section>
    <small className="muted">这里的抽签与工具均在本机运行，不保存输入、不上传数据。离开后，你可以随时重新开始。</small>
  </div>;
}

export const plugin: ZaituPlugin = {
  id: "zaitu.leisure",
  name: "摸鱼湾",
  tagline: "人生也需要补给站",
  description: "抽一张放松签，用小工具给工作日一点柔软。",
  icon: "🐠",
  category: "leisure",
  accent: "#81b4cb",
  permissions: [],
  Component: View,
};
