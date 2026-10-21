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

权限声明：`profile.read`（预留）、`timeline.read`、`timeline.write`、`ai.invoke`。timeline 仅实现代码侧声明检查，**不是最终用户授权或恶意插件的隔离机制**；声明 `timeline.read` 的内置插件可读取全部足迹。`ai.invoke` 另有宿主同意弹窗与可撤销的浏览器授权记录。不得把该架构描述为已支持安全第三方市场。外部插件未来必须进入 sandbox，并通过 UI 提示授权。

宿主使用 `makeContext(plugin, { requestAIConsent })`，卸载时先 `context.dispose()` 再执行插件清理函数。释放后不能发布足迹或调用 AI；已发出的 AI 请求会尝试中止，但不能撤回服务商已接收的数据。`storage.get/set/remove` 按合法插件 id 分隔命名空间，写入和删除失败会抛出可显示错误。插件应处理自身异步任务和事件处理函数中的错误。

事件命名：`<domain>.<past-tense-verb>`，例如 `mood.logged`。固定字段 id/type/source/occurredAt/data。插件数据可能包含敏感信息，事件原则只保存最小必需字段。

目录：`plugins/<id>/package.json`, `src/index.tsx`, `README.md`，测试文件后续跟进。插件文档要写明数据与 AI 发送边界。
