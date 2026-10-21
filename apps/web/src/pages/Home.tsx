import type { ZaituPlugin } from "@zaitu/plugin-sdk";
import { EmptyState } from "@zaitu/design-system";
import { useTimeline, formatTime } from "../hooks";
import { href } from "../router";
import { pluginById, plugins } from "../plugins";
import { isEnabled } from "@zaitu/core";

export function PluginCard({ p }: { p: ZaituPlugin }) {
  return (
    <a className="card plugin-card" href={href({ name: "plugin", id: p.id })}>
      <span className="plugin-icon" style={{ background: p.accent + "33" }} aria-hidden="true">{p.icon}</span>
      <h3>{p.name}</h3>
      <p className="muted">{p.description}</p>
      <span className="pill">探索更多 →</span>
    </a>
  );
}

export function Home() {
  const events = useTimeline();
  const available = plugins.filter((p) => isEnabled(p.id));
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">LIFE, IN PROGRESS</span>
          <h1 tabIndex={-1}>人生漫漫，<br />与你同行。</h1>
          <p>每段旅程都有属于自己的节奏。收藏喜欢的工具，记录小小的成长，把今天过成你喜欢的样子。</p>
          <a className="btn link-btn" href={href({ name: "plugins" })}>探索我的行囊 →</a>
        </div>
        <div className="hero-art" aria-hidden="true">🌿</div>
      </section>
      <div className="section-title">
        <h2>你的旅途伙伴</h2>
        <a className="ghost" href={href({ name: "plugins" })}>查看全部 →</a>
      </div>
      {available.length ? (
        <div className="grid">{available.map((p) => <PluginCard key={p.id} p={p} />)}</div>
      ) : (
        <div className="card"><EmptyState title="所有插件都已停用">去插件中心重新启用吧。</EmptyState></div>
      )}
      <div className="section-title">
        <h2>最近的足迹</h2>
        <a className="ghost" href={href({ name: "timeline" })}>更多 →</a>
      </div>
      <div className="card">
        {events.length ? (
          events.slice(0, 3).map((e) => (
            <div className="event" key={e.id}>
              <b>{pluginById(e.source)?.name ?? e.source}</b> · {e.type} <small
                className="muted">{formatTime(e.occurredAt)}</small>
            </div>
          ))
        ) : (
          <EmptyState title="旅途刚刚启程">去「心晴」留下第一条记录吧。</EmptyState>
        )}
      </div>
    </>
  );
}
