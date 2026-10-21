# DESIGN SYSTEM

## 视觉原则
自然清爽、旅途手账、降低认知负荷。统一品牌主色海松绿、背景奶白、卡片半透明；暗色用深绿灰背景。插件强调色可以变化但不能重写整体 Shell。

## Token
`--bg` 页面背景，`--panel` 表面，`--text` 文本，`--muted` 次级文本，`--line` 边框，`--primary` 操作色，`--primary-soft` 浅选中态，`--shadow` 阴影，`--radius` 统一圆角。所有插件必须消费这些 token。
标题：32/24/18px；正文 14–16px；附注 12–13px；布局间距基准 8px；可点击目标建议 >=44px。
组件建议：AppShell / TopNav / SurfaceCard / ActionButton / TextField / EmptyState / PermissionDialog / Toast / Modal；通过设计系统逐步提取而不是由六个小组重复实现。

## 体验规范
- 桌面最大内容宽度 1180px；移动 <=700px 单列。
- 主导航在桌面横排；移动自动换行或滚动。
- 使用真实文本标签、aria-label；颜色对比度需达到 WCAG AA。
- 异步 AI 必须展示 loading/error/retry，严禁显示虚构结果。
- 动效短、低干扰，遵循 prefers-reduced-motion。
