# 在途 · 0degree / ZAITU

> 人生漫漫，与你同行。 Life, in progress.

**在途**是一个可扩展的个人生活操作系统：独立生活插件 + 统一设计语言 + 用户授权的协作 + 持续反馈。

本仓库是一个 npm workspaces monorepo。主站、后端 AI 网关、插件运行时、插件 SDK、设计系统和六个首发生活插件独立组织。

## 快速开始

需要 Node.js >= 22 和 npm。

```bash
npm install
cp .env.example .env
# 编辑仓库根目录 .env，设置 DEEPSEEK_API_KEY
npm run dev
```

打开 http://localhost:5173 。API 位于 http://localhost:8787 ，由 Vite 本地代理转发 `/api` 请求。未配置密钥时，普通插件照常使用，AI 功能会提示配置。

**安全提示：** 根目录 `.env` 被 Git 忽略；请勿提交真实 API 密钥、在浏览器侧使用 `VITE_DEEPSEEK_API_KEY`，或直接从前端调用 DeepSeek。

## 文档

- [设计总览](docs/DESIGN.md)
- [实施计划](docs/IMPLEMENTATION.md)
- [设计系统](docs/DESIGN_SYSTEM.md)
- [插件开发契约](docs/PLUGIN_SPEC.md)

## 模块

- `apps/web`：生活首页、插件中心、个人事件流、AI 助手
- `apps/api`：仅服务端可读密钥的 DeepSeek 代理
- `packages/plugin-sdk`：插件契约与类型
- `packages/core`：插件注册、事件、存储、跨插件调用
- `packages/design-system`：统一设计变量
- `plugins/*`：心晴、食光、生命刻度、摸鱼湾、知行、自由航线

## 命令

```bash
npm run dev           # 同时运行 Web 与 API
npm run dev:web       # 仅前端
npm run dev:api       # 仅后端
npm run typecheck
npm run build
```

当前是架构可演示的 MVP scaffold，并非生产环境的插件沙箱、健康诊断或投资建议系统。详见实施文档的里程碑与风险说明。
