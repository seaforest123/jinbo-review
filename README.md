# 金箔非遗数字体验与活化传播项目

这是一个微信小程序 P0 候选内测实现，用于验证五道连续工艺任务、匿名埋点与 CloudBase 最小权限边界。项目不是公开发布版，所有文化与工艺内容均须以专业审核结果为准。

## 当前状态

- 已完成：五个 P0 页面壳层、两条候选路线、五任务共享厚度网格、检查回退与结果留痕、能力降级、匿名事件契约、CloudBase 规则与云函数离线实现。
- 当前候选路线均为 `internal_placeholder` / `internal_approved`，仅面向 `development` 和 `trial`。
- 未完成：真实 CloudBase 部署、真实小程序配置、专业内容确认、上传、体验码、真机验收和公开发布。

## 本地验证

运行全部自动化测试：

```powershell
npm test
git diff --check
```

## 微信开发者工具

1. 复制 `project.config.example.json` 为本地 `project.config.json`，保持游客模式配置；不要提交该本地文件。
2. 导入仓库根目录，确认小程序根目录为 `miniprogram/`、云函数根目录为 `cloudfunctions/`。
3. 在候选路线中完成五道工艺任务，检查裁切、装家生、落锤、旋转箔包、检查回退、切箔结果与路线重启。
4. 未部署云函数或断网时，体验仍可继续；匿名埋点可失败且不阻断流程。

## CloudBase 部署前检查

详细步骤见 [cloudbase/README.md](cloudbase/README.md)。部署前必须：

- 创建只服务于此小程序的专用 CloudBase 内测环境；
- 应用四个集合规则和 `function-rules.json`；
- 按 `cloudbase/seed-data/` 的顺序导入离线候选数据；
- 为三个云函数单独设置环境变量，且不得将真实值写入仓库；
- 保持候选内容的免责声明，未完成专业确认前不得改为正式路线或公开发布。

## 第 11 项边界

第 11 项才执行真实 AppID 与 CloudBase 环境配置、规则导入、云函数部署、小程序上传、体验二维码生成及 iOS/Android 真机验收。完成这些操作和专业内容确认前，不得提交公开审核。

## 项目导航

- [项目文件导航](README_项目文件导航.md)
- [CloudBase 离线接入与部署边界](cloudbase/README.md)
- [当前开发进度](docs/progress/当前开发进度_20260721.md)
