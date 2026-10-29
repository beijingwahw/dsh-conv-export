# dsh-conv-export（对话导出）

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-blue)](https://github.com/topics/dsh-plugin)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek-Harness-orange)](https://github.com/deepseek-ai/deepseek-harness)

[English](README.en.md) | 中文

> **本 fork 的改动（v0.2.0）**：①**移除批量导出**——上游的宿主半经 `ctx.webServer` 挂载无鉴权的 `/conv-export` 前缀路由，同机任意进程零凭据即可拉走全部会话全文（对照 `/api/*` 一律 401），列表接口每次全量折标题实测 18s+，且日志派生的 Markdown 会连 `<system-reminder>`/AGENTS.md 一并导出；本 fork 将宿主半整体删除，`manifest.json` 不再申请 `webServer` / `sessionQuery` 权限。②**新增单轮导出**——每条助手回复的动作条（插槽 `conversation.chat.assistant-actions`）里有一个下载按钮，点击复用同一菜单但只导出这一轮。

把当前 DeepSeek Harness 对话（或其中**任意一轮**）导出为 **Markdown**、**单文件 HTML**、**PDF**（免打印对话框直接下载）或**长图 PNG**，还可一键**复制 Markdown** 到剪贴板——会话头部或气泡动作条一次点击，零核心改动、纯浏览器端。

## 解决的问题

- **对话会蒸发**：长对话里沉淀着决策、代码与排错线索，但 Harness 没有内置方式把它们带走。本插件把渲染出的对话记录变成可携带的产物。
- **一种格式永远不够**：分享给同事要 Markdown；归档留痕要 PDF；贴进聊天要图片。一个菜单三种格式全有。
- **整段常常也不是要的那段**：只想要某一条回答——气泡下的单轮按钮直接导出这一轮，文件名自动带「-回合N」。
- **导出必须与所见一致**：提取在点击时刻对渲染 DOM 执行（含翻页加载的历史），产物就是屏幕上的对话——代码块、表格、强调全部保留；思考块、工具卡片与注入的指令层不在 DOM 正文里，天然不会混入。

## 功能特性

- **头部导出按钮**（下载图标）注册进 `conversation.session.header.actions` 插槽——可叠加、可安全卸载，打开状态经 `aria-pressed` 镜像。
- **每轮导出按钮**（下载图标）注册进 `conversation.chat.assistant-actions` 插槽——出现在每条已定稿助手回复的复制/点赞动作条里；点击复用同一菜单，但提取范围限定为该轮。定位按三层依次降级：① 插槽给的 `messageId` → `data-chat-anchor-key` 座位精确命中；② 按钮序号映射——本插件每条回复恰有一个按钮，与正文一一对应时按下标取（这条专治「动作条与正文不交错、取前驱永远命中第一条」的布局）；③ 文档序取按钮之前最近的正文。选中正文若紧邻一条用户提问，导出为「问 + 答」整段；按钮挂载时抄用同排按钮的 class，颜色/尺寸/hover 与皮肤一致。
- **单轮模式**下菜单隐藏「选择回合导出…」（单轮无从勾选），文件名追加「-回合N」序号。
- **下拉菜单**六项（单轮模式下隐藏第五项）：
  - **Markdown (.md)**——客户端下载；助手回复从渲染 HTML 反向序列化（标题、列表、带语言的围栏代码、表格、引用、链接、行内强调）。
  - **HTML (.html)**——自包含单文件：样式全部内联、图片转为 data URL，双击即读、即席可分享；文本保持可选可检索，内嵌打印样式使「打印 → 存为 PDF」成为可选文本 PDF 的替代路径。
  - **PDF（下载）**——对话分片光栅后按 A4 比例切页（页界与片界对齐、页数无上限、峰值内存恒为单片量级），下载自包含的多页 PDF。无打印窗、无弹窗：应用标签页永不冻结。
  - **长图 (PNG)**——分片光栅（`foreignObject` 窗口 `translateY` 位移，片高 = A4 页高 × 2）+ 流式 PNG 编码（片级自适应行过滤 → `CompressionStream('deflate')` 增量压缩），图片内联为 data URL。PNG 规范无高度上限，理智上限约 176 页 A4（200,000 CSS px）；无 `CompressionStream` 的环境退回旧的单 canvas 截断路径（16000px）。
  - **复制 Markdown**——一键写入剪贴板，免去下载-打开-复制的往返；剪贴板不可用（非安全上下文）时给出降级提示。
  - **选择回合导出…**——打开回合选择面板：逐回合勾选（角色 + 内容预览，默认全选）、全选/全不选、已选计数实时更新，再挑选导出格式（Markdown / HTML / PDF / 长图），确认后仅导出选中回合（如剔除失败的尝试或跑题的段落）。导出进行中确认按钮显示分片进度，再次点击或「取消」中止。
- **合理的文件名**取自会话标题（净化、限长）；单轮导出追加「-回合N」。
- 跟随 Harness `--dsw-alias-*` 设计令牌；菜单文案按**当前** `<html lang>` 判定中/英文——首次读取不再缓存死（早期版本在 locale 插件写入 `zh-CN` 之前就缓存了产品默认 `en`，导致界面恒为英文），语言切换即时跟随；`lang` 仍为未触碰的 `en` 且浏览器语言为中文时按中文处理。
- 菜单卫生：Escape 或点击外部关闭；光栅导出进行中菜单项实时显示「done/total」进度，再次点击同一菜单项即可取消；长图光栅失败时给出 toast 提示。选择面板空闲时 Escape 或点击遮罩关闭，导出进行中经取消按钮中止。

## 安装

需要 Node.js ≥ 22 与 pnpm（`npm install -g pnpm`）——`dsh plugin add` 通过 pnpm 把 bundle 装入 profile。

### 一键安装（本 fork）

```sh
dsh plugin add ZIye1208/dsh-conv-export --profile web
dsh web
```

> 常用进阶命令：升级 `dsh plugin upgrade dsh-conv-export --profile web`；卸载 `dsh plugin remove dsh-conv-export --profile web`；本地路径安装 `dsh plugin add ./dsh-conv-export --profile web`。桌面版 profile 由 Electron 应用独占管理，需走桌面端的插件安装方式。

包内声明了 `dsh.bundle.patch`（挂载插件注册行，boot graph 靠它发现 `dsh.client`）与 `dsh.client`（在 `/plugins/<id>/client.js` 提供浏览器端）。`lib/` 已提交，因此 GitHub 短名安装时无需构建步骤。

## 使用

- **整段对话**：打开任意对话，点击会话头部的下载图标，选择格式。四种下载格式均直接下载——无弹窗，应用标签页保持响应；「复制 Markdown」则直接写入剪贴板。
- **某一轮**：在该条助手回复下方的动作条里点下载图标，菜单与上面相同（此时「选择回合导出…」隐藏），导出文件名追加「-回合N」。
- **自选若干轮**：会话头部菜单 →「选择回合导出…」，勾选后挑格式。

导出全部为纯对话正文：思考块、工具调用/结果卡片与注入的 `<system-reminder>` 不在渲染正文里，因此不会出现在产物中（日志派生的批量导出已随本 fork 移除，那条路径才会带出这些内容）。

## 实现原理

- 全部路径（Markdown / HTML / PDF / 长图 / 回合选择 / 单轮导出）位于浏览器 bundle（`lib/client.js`），由标准加载器挂载，零核心改动、零宿主服务依赖。宿主入口 `src/index.ts` 是空壳——本 fork 删掉了上游的 `/conv-export` 服务层（`webServer` + `sessionQuery`），`manifest.json` 相应不再申请这两个权限。
- 整段提取按文档顺序遍历 `[data-conversation-scroll]`，配对用户行（`[class*="_userRow"]` 气泡）与助手 markdown 容器（`[class*="_markdown_"]`）——标准渲染器的稳定 class 契约。
- 单轮提取（`extractTurn`）三层降级：① `messageId` 座位——插槽给出助手消息 id，面板按消息键渲染 `[data-chat-anchor-key]` 座位，精确命中；② 按钮序号映射——按钮与正文数量相等时按下标取；③ 文档序——取按钮之前最近的一条顶层正文（按钮排在正文上方时取其后继）。选中正文前紧邻的用户提问一并纳入。轮次序号取该正文在面板顶层 markdown 容器中的位次，用于「-回合N」文件名。
- 长图/PDF 路径为分片光栅：离屏舞台存活期内作为克隆源，逐片序列化干净克隆（显式 XHTML 命名空间、无离屏偏移、经 `translateY(−offset)` 窗口位移）进 SVG `foreignObject`，`DOMParser` 校验后在独立 2x canvas 光栅化（片高 = A4 页高 × 2）。外部图片先抓取内联；不可达的图片被丢弃而非污染画布。PNG 经流式编码器逐片取像素、逐行过滤（片级自适应选过滤器，跨片行连续性经原始行携带）后交 `CompressionStream('deflate')` 增量压缩——恰为 PNG 规范要求的 zlib 流。

## 已知限制

- 长图与 PDF 路径经 SVG `foreignObject` 光栅化（所有常青浏览器支持）；特殊嵌入内容可能被拍平。
- PDF 页面为光栅图像（文本不可选择）；需要可选中文本请用 Markdown 或 HTML 导出（后者还支持浏览器打印为可选文本 PDF）。
- 导出范围仅限当前对话列——侧边栏标题与设置页面不在范围内。
- 单轮导出依赖 `conversation.chat.assistant-actions` 插槽与本轮的 chat-node 座位：DSH 改动插槽名或座位结构时会退化（兜底取离按钮最近的正文），极端情况下可能取到相邻轮次，此时用「选择回合导出…」精确勾选即可。
- 本 fork 无批量导出：需要跨历史会话打包时，请用官方 `/export`（会话头部 → Session log，导出原始会话日志 ZIP）。

## 排障

- `dsh plugin add` 时报 `'pnpm' 不是内部或外部命令` → 先安装 pnpm：`npm install -g pnpm`。
- 拉取 GitHub tarball 报 `ETIMEDOUT` → pnpm/Node 不读 Windows 系统代理（浏览器读、终端不读）。一次性修复、永久生效——把代理写进 npm 配置（pnpm 同样读它）：

  ```powershell
  $s = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
  if ($s.ProxyEnable -and $s.ProxyServer) {
    npm config set proxy "http://$($s.ProxyServer)"
    npm config set https-proxy "http://$($s.ProxyServer)"
  }
  ```

  之后所有 `dsh plugin add` / `pnpm` / `npm` 调用自动走代理，无需任何环境变量。不用代理时用 `npm config delete proxy; npm config delete https-proxy` 还原。仅当次会话生效的替代：`$env:HTTPS_PROXY = "http://$($s.ProxyServer)"`。或把代理工具切到 TUN/全局模式，全流量覆盖。想固定端口的话，选个冷门的如 **49151**——动态端口区间（49152–65535）之前的最后一个注册端口，常见服务、系统随机分配、各家代理工具默认都不会落到它上面。免端口兜底：浏览器下载 tarball 后本地安装：`dsh plugin --profile web add .\Downloads\main.tar.gz`。
- `dsh web` 报 `EADDRINUSE ... :3080` → 上一个 `dsh web` 仍占用端口。在其终端按 Ctrl+C 停掉；Windows 可用 `Get-NetTCPConnection -LocalPort 3080 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`，或换端口启动：`dsh web --port 3081`。

## 许可证

MIT
