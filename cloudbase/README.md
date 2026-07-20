# CloudBase 内测后端接入

本目录只提供离线配置、部署边界和验收步骤；Task 7 不执行真实云端写入。正式操作前，须创建并绑定仅服务于这一个微信小程序的专用 CloudBase 环境，并确认目标小程序 AppID 已关联该环境。不得把已有 Web、其他小程序或多来源业务共用环境作为替代。

## 1. 四个集合与方案 A

只允许创建 `app_config`、`content_items`、`media_assets`、`behavior_events` 四个集合，不得增加 analytics 集合或原始用户标识集合。先把 `database-rules/` 中四份同名 JSON 应用到对应集合，再导入内测数据。

经用户批准的冲突解决采用方案 A（Option A）：`behavior_events` 的 client read/create/update/delete=false。客户端对该集合没有任何直接权限，所有正式事件写入只能通过 `submitBehaviorEvent` 云函数的服务端事务完成。`app_config`、`content_items`、`media_assets` 只允许读取已审核且 `allowedEnvironment == 'trial'` 的记录，客户端写入始终关闭；`confirmRoute` 是唯一专业审批写入口。

规则语法与部署方式见 [CloudBase 数据库安全规则官方文档](https://docs.cloudbase.net/en/database/security-rules)。

## 2. 云函数调用权限

`function-rules.json` 是待部署到目标环境的云函数安全规则：通配项默认 `invoke: false`，仅对 `bootstrapAnonymousId`、`confirmRoute`、`submitBehaviorEvent` 使用 CloudBase 官方 DSL 示例的精确表达式 `auth.loginType != 'ANONYMOUS' && auth != null`。这里按官方规则 DSL 导入，不把它解释或宣传为 JavaScript 的空值求值语义。在 CloudBase 控制台或微信开发者工具的环境级函数权限界面导入并复核这份 JSON；它不是数据库规则，也不能靠上传函数目录自动生效。

CloudBase 函数权限规则只能约束客户端 SDK 的 `callFunction` 调用，无法仅凭该规则区分微信小程序与其他已认证非匿名客户端，也不覆盖管理 API、定时触发器或数据库触发器。因此这里不检查或臆造 `SOURCE` 值。三个函数还必须从 `cloud.getWXContext()` 读取可信 `OPENID` 与 `APPID`，并将 `APPID` 与环境变量 `WECHAT_APP_ID` 精确比较；缺失或不匹配均失败关闭。APPID 精确比较不能消除混合来源环境中的陈旧上下文风险，所以专用环境是强制部署边界，而不是可选加固。原始 OPENID/UNIONID 不得记录日志、返回或持久化。

该专用环境不得注册、启用或暴露 Web SDK，也不得为任何其他客户端配置认证或云函数调用入口。除指定小程序的 `wx.cloud.callFunction` 外，不得保留其他客户端认证/调用通道；运维侧管理访问须按最小权限关闭非必要主体，禁止用管理 API 绕过三函数入口。

函数规则的适用范围和支持表达式见 [CloudBase 云函数安全规则官方文档](https://docs.cloudbase.net/en/cloud-function/security-rules)。

## 3. 环境变量硬化

在三个云函数的控制台配置中设置：

- `ANONYMIZATION_SALT`：三个函数一致；去除首尾空白后至少 32 个字符，不得写入源码、JSON、Git 历史或文档示例。
- `WECHAT_APP_ID`：目标小程序的精确 AppID，必须匹配严格格式 `^wx[a-f0-9]{16}$`，也必须与可信上下文 `APPID` 完全一致。
- `APPROVER_IDS`：仅 `confirmRoute` 必需；英文逗号分隔的非空匿名审批人 ID，禁止空项、重复项或非匿名 ID。

不要设置 OPENID/UNIONID 环境变量，也不要接受调用方传入的身份字段。

## 4. 已确认路线的内容供给与原子审批

在调用 `confirmRoute` 前，操作者必须先在目标 `content_items` 记录中完成专业审核，并提供 `confirmedRoute`。`confirmedRoute` 是精确 closed-shape 对象，只能包含以下客户端可见替换字段：

```json
{
  "displayName": "已审核路线名称",
  "banner": "已审核路线说明",
  "steps": [
    { "id": "observe", "order": 1, "adapter": "select", "title": "已审核步骤一" },
    { "id": "motion", "order": 2, "adapter": "continuous-drag", "title": "已审核步骤二" },
    { "id": "inspect", "order": 3, "adapter": "inspect", "title": "已审核步骤三" }
  ]
}
```

`displayName` 最长 80 字符，`banner` 最长 200 字符；每个 step 必须精确包含 `id/order/adapter/title`，`id` 最长 64 个小写字母、数字、下划线或连字符且以字母或数字开头，`title` 最长 120 字符。步骤必须恰好三个、顺序为 1/2/3、ID 唯一，adapter 只能是 `select`、`continuous-drag`、`inspect` 或 `xr-frame`。所有文本须为无首尾空白的非空字符串。

已审核替换文案不得包含“候选示意”“尚未经专业确认”“待专业确认”“内部测试”，也不得包含作为独立标记的 `internal_placeholder`（Latin 大小写不敏感）。不得只把 `reviewStatus` 改为 `reviewed` 而遗漏 `confirmedRoute`，也不得把 placeholder 文案或素材字段复制进该对象。

`confirmRoute` 在同一个数据库事务内重新读取 `content_items/{contentItemId}` 与既有 `app_config/{routeId}`：从既有配置取得稳定 route ID、trial 环境范围与 `internal_approved` policy，从已审核 `confirmedRoute` 取得新的 `displayName/banner/steps`，再把状态和替换文案、内容版本、审批审计原子写回。替换缺失、畸形或仍含候选标记时整笔事务失败且不写入，避免 `confirmed` 状态与 placeholder 内容混用。

## 5. 仅事件函数部署

按顺序部署 `bootstrapAnonymousId`、`confirmRoute`、`submitBehaviorEvent`。在微信开发者工具中分别右键函数目录，选择“上传并部署：云端安装依赖”，不要上传本地 `node_modules`。每个目录都将 `wx-server-sdk` 固定为 `3.0.1`，无需本地安装依赖。

三个函数必须保持普通事件函数，只允许这个专用环境所绑定小程序侧的 `wx.cloud.callFunction` 进入既定入口。部署配置中不得启用 HTTP 函数、HTTP/API 网关、混合触发、定时触发器或数据库触发器；不得暴露 Web SDK、其他客户端调用入口或非必要管理访问；如发现任何附加触发器或调用通道，验收失败。CloudBase 的 HTTP 函数部署边界见 [CloudBase CLI 函数部署官方文档](https://docs.cloudbase.net/en/cli-v1/functions/deploy)，小程序调用方式见 [微信小程序调用 CloudBase 云函数官方文档](https://docs.cloudbase.net/en/recipes/add-cloud-function-wechat-miniprogram)。

## 6. 验收边界

离线先运行 `npm test`，确认规则精确语义、配置失败关闭、无日志/原始身份字段、审批事务审计、客户端 adapter 精确响应与事件持久幂等测试全部通过。仓库 fake transaction 只模拟可串行化原子提交，用于证明同一 `eventId` 的重放与冲突逻辑；它不模拟 CloudBase 的真实冲突检测、重试次数或网络调度。

真实部署验收仍须在只绑定这个小程序的专用隔离内测环境执行：复核四个集合和两类规则并实际导入函数规则；复核每个待确认 `content_items` 已包含经专业审核且无 placeholder 标记的 `confirmedRoute`；复核没有 Web SDK、其他客户端认证/调用入口、HTTP、管理 API 暴露、混合/定时/数据库触发或非必要管理主体；验证缺失或错误 APPID 被拒绝；并以真实 CloudBase 并发提交同 ID 同 payload 和同 ID 不同 payload，确认前者只写一次且返回精确确认，后者拒绝且不覆盖。由于 APPID 比较本身无法排除混合来源环境中的陈旧可信上下文，若环境不是专用环境则验收直接失败。持久事务语义见 [CloudBase 事务官方文档](https://docs.cloudbase.net/en/database/transaction)。完成这些检查前不得提交正式公开审核。
