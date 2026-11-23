# dsh-conv-export（对话导出）

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-blue)](https://github.com/topics/dsh-plugin)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek-Harness-orange)](https://github.com/deepseek-ai/deepseek-harness)

[English](README.en.md) | 中文

把当前 DeepSeek Harness 对话导出为 **Markdown**、**单文件 HTML**、**PDF**（免打印对话框直接下载）或**长图 PNG**，还可一键**复制 Markdown** 到剪贴板、**批量导出**多个历史会话为 Markdown ZIP——会话头部一次点击，零核心改动。

## 解决的问题

- **对话会蒸发**：长对话里沉淀着决策、代码与排错线索，但 Harness 没有内置方式把它们带走。本插件把渲染出的对话记录变成可携带的产物。
- **一种格式永远不够**：分享给同事要 Markdown；归档留痕要 PDF；贴进聊天要图片。一个菜单三种格式全有。
- **一份往往也不够，要一批**：交接与归档常需要把多个历史会话一次带走。批量导出把它们各自生成一份 Markdown，打包成一个 ZIP。
- **带走的 ZIP 本身就是档案馆**：批量导出的 ZIP 自带一个 `index.html` 离线阅读器与 `manifest.json` 机器可读索引——解压后双击即可浏览全部会话、即时全文搜索、逐会话复制 / 下载 Markdown，无需服务器、无需联网。阅读器还是一份**智能档案**：侧栏按日期把会话排成时间线、每个会话自带首问摘要（不点开即知主题）、顶部统计条一览会话数 / 总轮次 / 时间跨度；manifest 同步携带逐会话 `preview` 与全局 `stats`，脚本与外部工具可直接消费档案画像。
- **导出必须与所见一致**：提取在点击时刻对渲染 DOM 执行（含翻页加载的历史），产物就是屏幕上的对话——代码块、表格、强调全部保留。

## 功能特性

- **头部导出按钮**（下载图标）注册进 `conversation.session.header.actions` 插槽——可叠加、可安全卸载，打开状态经 `aria-pressed` 镜像。
- **下拉菜单**五种导出 + 回合选择：
  - **Markdown (.md)**——客户端下载；助手回复从渲染 HTML 反向序列化（标题、列表、带语言的围栏代码、表格、引用、链接、行内强调）。
  - **HTML (.html)**——自包含单文件：样式全部内联、图片转为 data URL，双击即读、即席可分享；文本保持可选可检索，内嵌打印样式使「打印 → 存为 PDF」成为可选文本 PDF 的替代路径。
  - **PDF（下载）**——对话分片光栅后按 A4 比例切页（页界与片界对齐、页数无上限、峰值内存恒为单片量级），下载自包含的多页 PDF。无打印窗、无弹窗：应用标签页永不冻结。
  - **长图 (PNG)**——分片光栅（`foreignObject` 窗口 `translateY` 位移，片高 = A4 页高 × 2）+ 流式 PNG 编码（片级自适应行过滤 → `CompressionStream('deflate')` 增量压缩），图片内联为 data URL。PNG 规范无高度上限，理智上限约 176 页 A4（200,000 CSS px）；无 `CompressionStream` 的环境退回旧的单 canvas 截断路径（16000px）。
  - **复制 Markdown**——一键写入剪贴板，免去下载-打开-复制的往返；剪贴板不可用（非安全上下文）时给出降级提示。
  - **选择回合导出…**——打开回合选择面板：逐回合勾选（角色 + 内容预览，默认全选）、全选/全不选、已选计数实时更新，再挑选导出格式（Markdown / HTML / PDF / 长图），确认后仅导出选中回合（如剔除失败的尝试或跑题的段落）。导出进行中确认按钮显示分片进度，再次点击或「取消」中止。
  - **批量导出会话…**——打开会话选择面板：按标题 / 会话 ID 实时筛选、逐个勾选、全选/全不选（作用于当前筛选结果并与已有选择取并集）、已选计数实时更新；确认后所选会话各生成一份 Markdown，打包为单个 ZIP 下载（单次最多 100 个会话，自动去重；读取失败的会话自动跳过，不阻塞其余条目）。打包进行中按钮显示「正在打包…」，再次点击或「取消」中止；打包期间 Esc / 遮罩不关闭面板。
- **合理的文件名**取自会话标题（净化、限长）。
- 跟随 Harness `--dsw-alias-*` 设计令牌；菜单文案按文档语言自动切换中/英文。
- 菜单卫生：Escape 或点击外部关闭；光栅导出进行中菜单项实时显示「done/total」进度，再次点击同一菜单项即可取消；长图光栅失败时给出 toast 提示。选择面板空闲时 Escape 或点击遮罩关闭，导出进行中经取消按钮中止。

## 安装

需要 Node.js ≥ 22 与 pnpm（`npm install -g pnpm`）——`dsh plugin add` 通过 pnpm 把 bundle 装入 profile。

### 一键安装

```sh
dsh plugin add beijingwahw/dsh-conv-export --profile web
dsh web
```

> 常用进阶命令：升级 `dsh plugin upgrade dsh-conv-export --profile web`；卸载 `dsh plugin remove dsh-conv-export --profile web`；本地路径安装 `dsh plugin add ./dsh-conv-export --profile web`。

包内声明了 `dsh.bundle.patch`（挂载宿主注册行）与 `dsh.client`（在 `/plugins/<id>/client.js` 提供浏览器端）。`lib/` 已提交，因此 GitHub 短名安装时无需构建步骤。

## 使用

打开任意对话，点击会话头部的下载图标，选择格式。四种下载格式均直接下载——无弹窗，应用标签页保持响应；「复制 Markdown」则直接写入剪贴板。

**批量导出**：菜单选择「批量导出会话…」，在面板中筛选并勾选目标会话，确认后下载 ZIP（每个会话一份 `.md`，含会话 ID / 创建时间 / 消息轮次等元信息头与时间戳）。ZIP 同时内置：
- `index.html`——自包含离线阅读器（双击即用，`file://` 可直接打开）：侧栏为按创建日期分组的时间线（粘性日期组头），每个会话条目自带首问摘要预览（两行截断）；顶部统计条一览会话数 / 总轮次 / 时间跨度；即时全文搜索（标题 + 摘要 + 正文，按 `/` 聚焦，命中高亮、无匹配提示）、角色徽章渲染视图 / Markdown 源码切换、一键复制与单会话 `.md` 下载，明暗主题自动跟随系统；
- `manifest.json`——机器可读索引（version 2）：`id → 文件名` 映射、轮次计数、逐会话 `preview` 摘要与全局 `stats`（会话数 / 总轮次 / 时间跨度）、导出时间，便于脚本与外部工具消费。

## 实现原理

- 单会话路径（Markdown / PDF / 长图 / 回合选择）完全位于浏览器 bundle（`lib/client.js`），由标准加载器挂载，零核心改动；批量导出需要跨会话读取历史对话——浏览器侧无法访问当前会话之外的转录——故宿主半（`lib/index.js`）新增一个**只读服务层**：经 `ctx.webServer` 挂载 `/conv-export` 前缀路由（`GET /sessions`、`POST /batch`），经 `ctx.sessionQuery` 读取会话并打包为 Markdown ZIP（零依赖打包器，STORE 方式）。无存储域、无出站网络请求、无状态；批量选择面板（筛选 / 勾选 / 全选 / 计数 / 取消）仍为纯 DOM，与回合面板共用同一套骨架与设计令牌。
- 提取按文档顺序遍历 `[data-conversation-scroll]`，配对用户行（`[class*="_userRow"]` 气泡）与助手 markdown 容器（`[class*="_markdown_"]`）——标准渲染器的稳定 class 契约。
- 长图/PDF 路径为分片光栅：离屏舞台存活期内作为克隆源，逐片序列化干净克隆（显式 XHTML 命名空间、无离屏偏移、经 `translateY(−offset)` 窗口位移）进 SVG `foreignObject`，`DOMParser` 校验后在独立 2x canvas 光栅化（片高 = A4 页高 × 2）。外部图片先抓取内联；不可达的图片被丢弃而非污染画布。PNG 经流式编码器逐片取像素、逐行过滤（片级自适应选过滤器，跨片行连续性经原始行携带）后交 `CompressionStream('deflate')` 增量压缩——恰为 PNG 规范要求的 zlib 流。

## 已知限制

- 长图与 PDF 路径经 SVG `foreignObject` 光栅化（所有常青浏览器支持）；特殊嵌入内容可能被拍平。
- PDF 页面为光栅图像（文本不可选择）；需要可选中文本请用 Markdown 或 HTML 导出（后者还支持浏览器打印为可选文本 PDF）。
- 导出范围仅限当前对话列——侧边栏标题与设置页面不在范围内。
- 批量导出仅支持 Markdown（PDF / 长图需客户端逐会话光栅化，不支持打包入 ZIP）；批量条目由会话日志派生（原始文本 + 元信息头），不经渲染 HTML 反向序列化，富文本格式以日志原文为准。

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
