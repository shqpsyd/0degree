# IMPLEMENTATION · 工作分解与验收

## 技术栈
Node >=22；npm workspaces monorepo；React + TypeScript + Vite 主站；Node 原生 HTTP 网关；Core & SDK 使用 TypeScript；浏览器本地存储。避免微服务/数据库过早拆分。

## 工作包和建议 Issue
**P0 Platform**
1. P0-01 Monorepo、统一命令、README、CI、lint/typecheck。
2. P0-02 Design tokens + 共享按钮/卡片/表单/弹窗 + 主题与移动端。
3. P0-03 插件注册、启停、权限声明、激活清理、错误隔离。
4. P0-04 个人事件流、存储迁移、导入导出、删除。
5. P0-05 后端 AI 网关、DeepSeek 配置、错误处理和成本控制。
6. P0-06 首页、插件中心、足迹、AI 助手、无障碍与路由。
**P1 Plugins**
7. P1-01 心晴完整交互与统计。
8. P1-02 食光偏好与日计划、AI 建议。
9. P1-03 摸鱼湾功能拆分与小游戏注册接口。
10. P1-04 生命刻度营养结构与来源提示。
11. P1-05 知行阅读评价策略与 AI 交互。
12. P1-06 自由航线 FIRE 情景计算与参数解释。
**P2 Integration**
13. P2-01 用户授权的插件能力调用及审计。
14. P2-02 情绪 → 饮食/休闲建议 → 确认 → 用户反馈的端到端闭环。
15. P2-03 目标/路标、可测量指标、用户控制数据导出。
16. P2-04 部署硬化：认证、限制、私有数据策略和端到端测试。

## 提交约定
主项目变动限定 `apps/`、`packages/`、`docs/`；插件 owner 优先修改自己的 `plugins/<id>/`。跨边界变更必须单独 PR 并由 Platform owner review。每个插件 PR 包括使用方式、权限变更、截图或录屏、测试和数据迁移说明。

## Definition of Done
- npm install / npm run dev 启动成功；npm run build / npm run typecheck 成功。
- 插件打开、切换、禁用时 UI 无错误；激活副作用有对应清理。
- 亮/暗主题及 375px 手机布局无溢出；完整键盘操作；reduced-motion 可用。
- 不含真实密钥；AI 失败时有错误反馈；不向前端发送 API Key。
- 产品所有计量都注明是假设、计算还是实测；不把演示数据误写成真实结果。

## 阶段验收
M0：空仓库变可运行脚手架、统一 UI、六个可点击插件、服务端 AI 代理。
M1：心晴 + 食光 + 摸鱼湾完整可用；用户可以完成一轮日常记录。
M2：跨插件授权工作流与用户反馈可追踪。
M3：文档化 API 稳定性、可选云同步与第三方沙箱方案。
