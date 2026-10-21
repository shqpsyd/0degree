# 在途 · 0degree / ZAITU

> 人生漫漫，与你同行。 Life, in progress.

**在途**是一个可扩展的个人生活操作系统：独立生活插件 + 统一设计语言 + 用户授权的协作 + 持续反馈。

本仓库是一个 npm workspaces monorepo。主站、后端 AI 网关、插件运行时、插件 SDK、设计系统和六个首发生活插件独立组织。

## 快速开始

需要 Node.js >= 22 和 npm。

```bash
npm install
# 如需 AI，在仓库根目录创建或编辑 .env，设置 DEEPSEEK_API_KEY
# 已存在的 .env 请保留，不要覆盖
npm run dev
```

打开 http://127.0.0.1:5173 。API 位于 http://127.0.0.1:8787 ，由 Vite 本地代理转发 `/api` 请求。未配置密钥时，普通插件照常使用，AI 功能会提示配置。

开发服务默认仅监听本机。不要在未增加认证的情况下将 Web 或 API 绑定到 `0.0.0.0`：
Web 的 `/api` 代理也会暴露使用服务端密钥的 AI 接口。

请使用支持 Web Locks 的现代浏览器。足迹同一时间只允许一个页面编辑，其他页面可以查看和导出；
若提示另一页面正在编辑，关闭该页面后重试保存（首次重试申请编辑权限，随后再保存）。

**安全提示：** 根目录 `.env` 被 Git 忽略；请勿提交真实 API 密钥、在浏览器侧使用 `VITE_DEEPSEEK_API_KEY`，或直接从前端调用 DeepSeek。

## 文档

- [设计总览](docs/DESIGN.md)
- [实施计划](docs/IMPLEMENTATION.md)
- [设计系统](docs/DESIGN_SYSTEM.md)
- [插件开发契约](docs/PLUGIN_SPEC.md)
- [P0 平台交接与验证](docs/PLATFORM_HANDOFF.md)

## 模块

- `apps/web`：生活首页、插件中心、个人事件流、AI 助手
- `apps/api`：仅服务端可读密钥的 DeepSeek 代理
- `packages/plugin-sdk`：插件契约与类型
- `packages/core`：插件注册、事件、存储、AI 同意与上下文生命周期
- `packages/design-system`：统一设计变量与共享组件
- `plugins/*`：心晴、食光、生命刻度、摸鱼湾、知行、自由航线

## 命令

```bash
npm run dev           # 同时运行 Web 与 API
npm run dev:web       # 仅前端
npm run dev:api       # 仅后端
npm run typecheck
npm run build
npm test              # core / API / UI 回归
npm run test:watch
```

当前为本地 P0 平台 MVP，尚未实现用户授权的跨插件协作、云同步或认证，也不是生产环境的插件沙箱、健康诊断或投资建议系统。详见平台交接文档的已实现边界和验证证据。
