# CloudBase 内测后端接入

本目录只描述离线配置与部署步骤；本任务不执行真实云端写入。正式操作前，在微信开发者工具中绑定仅用于内测的 CloudBase 环境，并确认小程序 AppID 已关联该环境。

## 1. 创建集合并先应用规则

仅创建 `app_config`、`content_items`、`media_assets`、`behavior_events` 四个集合。先将 `database-rules/` 中同名 JSON 规则逐一应用到对应集合，再导入后续内测数据。客户端只能读取已审核且 `allowedEnvironment == 'trial'` 的配置、内容和媒体；客户端不能修改这些集合。`behavior_events` 的客户端规则严格限制为仅创建，且不允许读取、更新或删除；实际埋点客户端通过 `submitBehaviorEvent` 云函数提交。

CloudBase 规则语法与部署方式见[数据库安全规则官方文档](https://docs.cloudbase.net/en/database/security-rules)。

## 2. 设置函数环境变量

在云函数控制台设置以下变量，不要写入源码、JSON、Git 历史或部署说明示例值：

- `ANONYMIZATION_SALT`：三个函数使用的同一非空匿名化盐值。
- `APPROVER_IDS`：仅 `confirmRoute` 使用，以英文逗号分隔的授权匿名 ID 列表。

不要设置或传入 OPENID/UNIONID 环境变量；函数只读取 `cloud.getWXContext()` 的可信小程序调用上下文。不要启用 HTTP 触发器。

## 3. 部署云函数

按顺序部署 `bootstrapAnonymousId`、`confirmRoute`、`submitBehaviorEvent`。在微信开发者工具中分别右键函数目录，选择“上传并部署：云端安装依赖”，不要上传本地 `node_modules`。每个目录都将 `wx-server-sdk` 固定为 `3.0.1`，无需本地安装依赖。

小程序 `wx.cloud.callFunction`、可信上下文与部署说明见[微信小程序调用 CloudBase 云函数官方文档](https://docs.cloudbase.net/en/recipes/add-cloud-function-wechat-miniprogram)。持久幂等写入使用服务端事务，参考[CloudBase 事务官方文档](https://docs.cloudbase.net/en/database/transaction)。

## 4. 离线验收后再部署

在仓库根目录运行 `node --test`。确认全部测试通过、函数目录中无日志语句、无真实标识符/盐值/审批人配置，并由操作者在控制台验证规则后，才可部署微信体验版；不得提交正式公开审核。
