import { useEffect, useMemo, useRef, useState } from "react";
import type { ContextOptions } from "@zaitu/core";
import type { ZaituPlugin } from "@zaitu/plugin-sdk";
import { Button, Modal } from "@zaitu/design-system";
import { Home } from "./pages/Home";
import { PluginCenter } from "./pages/PluginCenter";
import { PluginHost } from "./pages/PluginHost";
import { Timeline } from "./pages/Timeline";
import { Assistant } from "./pages/Assistant";
import { href, useRoute } from "./router";
import { useTheme } from "./hooks";

const titles = { home: "旅途首页", plugins: "插件中心", timeline: "我的足迹", ai: "AI 旅伴" } as const;
type Consent = { plugin: ZaituPlugin; resolve: (value: boolean) => void };

export default function App() {
  const route = useRoute();
  const { theme, toggle } = useTheme();
  const [consent, setConsent] = useState<Consent | null>(null);
  const pending = useRef<Consent | null>(null);
  const finish = (granted: boolean) => {
    pending.current?.resolve(granted);
    pending.current = null;
    setConsent(null);
  };
  const options = useMemo<ContextOptions>(() => ({
    requestAIConsent: (plugin) => new Promise<boolean>((resolve) => {
      // Fail closed if another request is already awaiting a decision.
      if (pending.current) { resolve(false); return; }
      pending.current = { plugin, resolve };
      setConsent(pending.current);
    }),
  }), []);
  const routeKey = route.name === "plugin" ? route.id : route.name;
  useEffect(() => {
    document.title = `${route.name === "plugin" ? "插件" : titles[route.name]} · 在途`;
    document.querySelector<HTMLElement>("main h1")?.focus();
    window.scrollTo({ top: 0 });
    return () => {
      pending.current?.resolve(false);
      pending.current = null;
      setConsent(null);
    };
  }, [routeKey, route.name]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content" onClick={(e) => {
        e.preventDefault(); document.getElementById("main-content")?.focus();
      }}>跳到主要内容</a>
      <header className="topbar">
        <a className="brand" href={href({ name: "home" })}><span className="brandmark">途</span>在途 <small
          className="muted">ZAITU</small></a>
        <nav className="nav" aria-label="主导航">
          {(Object.keys(titles) as (keyof typeof titles)[]).map((name) => {
            const active = route.name === name || (name === "plugins" && route.name === "plugin");
            return <a key={name} href={href({ name })} aria-current={active ? "page" : undefined}>{titles[name]}</a>;
          })}
        </nav>
        <Button variant="ghost" onClick={toggle} aria-label="切换深浅主题">{theme === "dark" ? "浅色主题" : "深色主题"}</Button>
      </header>
      <main id="main-content" tabIndex={-1}>
        {route.name === "home" && <Home />}
        {route.name === "plugins" && <PluginCenter />}
        {route.name === "plugin" && <PluginHost key={route.id} id={route.id} options={options} />}
        {route.name === "timeline" && <Timeline />}
        {route.name === "ai" && <Assistant />}
      </main>
      <footer className="footer">在途 · ZAITU · Life, in progress. · 你的旅途由你决定</footer>
      <Modal open={!!consent} title={`允许「${consent?.plugin.name ?? ""}」调用 AI？`} onClose={() => finish(false)}
        actions={<><Button variant="secondary" onClick={() => finish(false)}>取消</Button><Button
          onClick={() => finish(true)}>同意发送</Button></>}>
        <p>插件提交的消息将经本地网关发送给 AI 服务商。请勿发送不愿分享的隐私信息。</p>
        <p>此选择保存在当前浏览器，可在插件中心撤销。足迹读取仅按插件声明检查，不属于此 AI 授权。</p>
      </Modal>
    </div>
  );
}
