# 插件开发契约 v0.1

`packages/plugin-sdk` 定义唯一 `ZaituPlugin` 接口。

```tsx
const plugin: ZaituPlugin = {
  id: "zaitu.example",
  name: "示例",
  tagline: "一句产品话术",
  description: "具体作用与边界",
  icon: "🌿",
  category: "growth",
  accent: "#698f80",
  permissions: ["timeline.write"],
  Component: ExampleView,
  onActivate(context) {
    // 仅可按声明权限访问 context
    return () => { /* 清理事件/定时器 */ };
  }
};
```

插件注册在 `apps/web/src/plugins.ts`；运行时通过 `makeContext` 注入能力。

权限声明：`profile.read`（预留）、`timeline.read`、`timeline.write`、`ai.invoke`。当前仅实现 timeline 与 ai 的代码侧检查，**不是最终用户授权或恶意插件的隔离机制**。不得把该架构描述为已支持安全第三方市场。外部插件未来必须进入 sandbox，并通过 UI 提示授权。

事件命名：`<domain>.<past-tense-verb>`，例如 `mood.logged`。固定字段 id/type/source/occurredAt/data。插件数据可能包含敏感信息，事件原则只保存最小必需字段。

目录：`plugins/<id>/package.json`, `src/index.tsx`, `README.md`，测试文件后续跟进。插件文档要写明数据与 AI 发送边界。
