import { useState } from "react";
import type { ZaituPlugin } from "@zaitu/plugin-sdk";
import { Button, Modal, Notice } from "@zaitu/design-system";
import { clearEvents, clearPluginData, isEnabled, readAIConsent, setAIConsent, setEnabled } from "@zaitu/core";
import { href } from "../router";
import { permissionLabels, plugins } from "../plugins";

export function PluginCenter() {
  const [, refresh] = useState(0);
  const [resetting, setResetting] = useState<ZaituPlugin | null>(null);
  const [error, setError] = useState("");
  const consent = readAIConsent();
  const update = (fn: () => void) => {
    try {
      fn();
      setError("");
      refresh((x) => x + 1);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <>
      <div className="heading">
        <p className="eyebrow">MY COMPANIONS</p>
        <h1 tabIndex={-1}>插件中心</h1>
        <p className="muted">为自己的旅途挑选伙伴。每个插件声明自己需要的能力，你可以随时停用或撤销 AI 授权。</p>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="grid">
        {plugins.map((p) => {
          const on = isEnabled(p.id);
          return (
            <article className={`card plugin-tile${on ? "" : " disabled"}`} key={p.id} aria-label={p.name}>
              <div className="plugin-icon" style={{ background: p.accent + "33" }} aria-hidden="true">{p.icon}</div>
              <h3>{p.name}{!on && <span className="pill">已停用</span>}</h3>
              <p className="muted">{p.description}</p>
              <ul className="perm-list" aria-label="所需权限">
                {p.permissions.length
                  ? p.permissions.map((perm) => <li key={perm}>{permissionLabels[perm]}</li>)
                  : <li>无需额外权限</li>}
              </ul>
              <div className="row">
                {on ? <a className="btn link-btn" href={href({ name: "plugin", id: p.id })}>打开</a> : null}
                <Button variant="secondary"
                  onClick={() => update(() => setEnabled(p.id, !on))}>{on ? "停用" : "启用"}</Button>
                {consent[p.id] && (
                  <Button variant="ghost" onClick={() => update(() => setAIConsent(p.id, false))}>撤销 AI 授权</Button>
                )}
                <Button variant="ghost" onClick={() => setResetting(p)}>清除数据</Button>
              </div>
            </article>
          );
        })}
      </div>
      <Modal
        open={!!resetting}
        title={`清除「${resetting?.name}」的数据？`}
        onClose={() => setResetting(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setResetting(null)}>取消</Button>
            <Button
              variant="danger"
              onClick={() => update(() => {
                if (resetting) {
                  clearPluginData(resetting.id);
                  clearEvents(resetting.id);
                  setAIConsent(resetting.id, false);
                }
                setResetting(null);
                refresh((x) => x + 1);
              })}
            >
              清除
            </Button>
          </>
        }
      >
        <p>将删除该插件在本浏览器保存的私有数据、它写入的全部足迹以及 AI 授权。此操作无法撤销，建议先在「我的足迹」导出备份。</p>
      </Modal>
    </>
  );
}
