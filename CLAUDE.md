# CLAUDE.md

本文件面向 AI 编程助手（Claude Code 等），说明如何在本仓库中工作。

**产品与视觉的权威来源永远是 [PRODUCT_DESIGN.md](PRODUCT_DESIGN.md)。本文件不重复其内容，只补充它未覆盖的平台操作规则。两者冲突时以 PRODUCT_DESIGN.md 为准，且 PRODUCT_DESIGN.md 本身只能在向 Andrew 说明拟修改内容并获得明确确认后修改。**

## 技术栈

- 微信**原生**小程序（WXML / WXSS / JS），无 React / Vue，不使用任何组件库（TDesign / WeUI / Vant 等），现阶段维持全手写标记与样式。
- 深色展厅风格的设计 token 唯一来源是 PRODUCT_DESIGN.md §6.1（`--exhibit-*` 系列变量，定义在 `app.wxss`）。做该风格页面前必须先读那一节，禁止另起一套相近但不同的十六进制值。

## 微信小程序尺寸规范（写代码 / 改样式时必须遵守）

- 尺寸单位统一用 `rpx`；基准 750rpx = 375pt，以 iPhone 6 为视觉基准，1rpx = 0.5px。
- 导航栏高度参考 128rpx；tab 栏图标参考 81rpx。
- tab 数量 2–5 个，建议不超过 4 个。
- 右上角胶囊按钮（`wx.getMenuButtonBoundingClientRect`）位置固定、不可改；任何自定义顶部栏必须预留避让空间（本仓库已有 `navRightPadding` / `navTopPadding` 的实现方式，见 `miniprogram/services/navigation-layout.js`，新页面直接复用该服务，不要重新实现一套）。
- 二级页面必须提供明确、可见文字的返回入口（PRODUCT_DESIGN.md §6.2 已有更细的样式约定，如描边风格、"只出现一次"等，以那里为准）。

## 改动前必读

- 先读 PRODUCT_DESIGN.md 全文，尤其是第 6–7 节（视觉方向、工程硬约束）和第 8 节验收基线。
- 不得新增前端组件库或其他重量级依赖，除非与 Andrew 确认后再引入。
- 每次改动范围与任务声明保持一致，不顺手重构；改完对照 PRODUCT_DESIGN.md §8 验收基线自查。
