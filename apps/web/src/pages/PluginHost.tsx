import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import type { ZaituPlugin } from "@zaitu/plugin-sdk";
import { Button, EmptyState, Notice } from "@zaitu/design-system";
import { isEnabled, makeContext, type ContextOptions } from "@zaitu/core";
import { href } from "../router";
import { pluginById } from "../plugins";

/** 隔离单个插件的渲染错误，避免拖垮整个外壳。 */
class PluginBoundary extends Component<
  { name: string; children: ReactNode }, { error: Error | null; attempt: number }
> {
  state = { error: null as Error | null, attempt: 0 };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[plugin:${this.props.name}]`, error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="stack">
          <Notice tone="error">「{this.props.name}」出了点问题：{this.state.error.message}</Notice>
          <div className="row">
            <Button onClick={() => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))}>重新加载插件</Button>
          </div>
        </div>
      );
    }
    return <div key={this.state.attempt}>{this.props.children}</div>;
  }
}

function ActivePlugin({ plugin, options }: { plugin: ZaituPlugin; options: ContextOptions }) {
  const [context, setContext] = useState<ReturnType<typeof makeContext> | null>(null);
  const [activationError, setActivationError] = useState("");
  useEffect(() => {
    const context = makeContext(plugin, options);
    setContext(context);
    let cleanup: void | (() => void);
    try {
      cleanup = plugin.onActivate?.(context);
    } catch (e) {
      context.dispose();
      setActivationError(e instanceof Error ? e.message : String(e));
    }
    return () => {
      context.dispose();
      try {
        if (typeof cleanup === "function") cleanup();
      } catch (e) {
        console.error(`[plugin:${plugin.id}] cleanup failed`, e);
      }
    };
  }, [plugin, options]);
  return (
    <>
      {activationError && <Notice tone="error">插件初始化失败：{activationError}</Notice>}
      {context && !activationError && <plugin.Component context={context} />}
    </>
  );
}

export function PluginHost({ id, options }: { id: string; options: ContextOptions }) {
  const plugin = pluginById(id);
  const back = <a className="ghost" href={href({ name: "plugins" })}>← 返回插件中心</a>;
  if (!plugin) {
    return (
      <>
        {back}
        <div className="card"><EmptyState icon="🧭" title="没有找到这个插件">它可能已被移除或链接有误。</EmptyState></div>
      </>
    );
  }
  return (
    <>
      {back}
      <div className="heading">
        <p className="eyebrow">我的行囊 / {plugin.name}</p>
        <h1 tabIndex={-1}><span aria-hidden="true">{plugin.icon}</span> {plugin.name}</h1>
        <p className="muted">{plugin.tagline}</p>
      </div>
      <section className="card plugin-surface" style={{ ["--accent" as string]: plugin.accent }}>
        {isEnabled(plugin.id) ? (
          <PluginBoundary key={plugin.id} name={plugin.name}>
            <ActivePlugin plugin={plugin} options={options} />
          </PluginBoundary>
        ) : (
          <EmptyState icon="💤" title="该插件已停用">在插件中心启用后即可使用。</EmptyState>
        )}
      </section>
    </>
  );
}
