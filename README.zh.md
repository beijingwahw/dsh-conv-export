# dsh-conv-export（对话导出）

[English](README.md) | 中文

把当前 DeepSeek Harness 对话导出为 **Markdown**、**PDF**（打印对话框）或**长图 PNG**——会话头部一次点击，零核心改动。

## 解决的问题

- **对话会蒸发**：长对话里沉淀着决策、代码与排错线索，但 Harness 没有内置方式把它们带走。本插件把渲染出的对话记录变成可携带的产物。
- **一种格式永远不够**：分享给同事要 Markdown；归档留痕要 PDF；贴进聊天要图片。一个菜单三种格式全有。
- **导出必须与所见一致**：提取在点击时刻对渲染 DOM 执行（含翻页加载的历史），产物就是屏幕上的对话——代码块、表格、强调全部保留。

## 功能特性

- **头部导出按钮**（下载图标）注册进 `conversation.session.header.actions` 插槽——可叠加、可安全卸载，打开状态经 `aria-pressed` 镜像。
- **下拉菜单**三种导出：
  - **Markdown (.md)**——客户端下载；助手回复从渲染 HTML 反向序列化（标题、列表、带语言的围栏代码、表格、引用、链接、行内强调）。
  - **PDF（下载）**——对话光栅化后按 A4 比例切页，下载自包含的多页 PDF。无打印窗、无弹窗：应用标签页永不冻结。
  - **长图 (PNG)**——离屏渲染测量后经 SVG `foreignObject` 以 2x 光栅化，图片内联为 data URL，下载为一张长 PNG（高度上限 16000px）。
- **合理的文件名**取自会话标题（净化、限长）。
- 跟随 Harness `--dsw-alias-*` 设计令牌；菜单文案按文档语言自动切换中/英文。
- 菜单卫生：Escape 或点击外部关闭；长图光栅失败时给出 toast 提示。

## 安装

需要 Node.js ≥ 22 与 pnpm（`npm install -g pnpm`）——`dsh plugin add` 通过 pnpm 把 bundle 装入 profile。

```sh
dsh plugin --profile web add https://github.com/beijingwahw/dsh-conv-export/archive/refs/heads/main.tar.gz
dsh web   # 重启服务以加载插件
```

## 使用

打开任意对话，点击会话头部的下载图标，选择格式。三种格式均直接下载——无弹窗，应用标签页保持响应。

## 实现原理

- 宿主半边是空的 cordis 注册外壳；全部行为位于浏览器 bundle（`lib/client.js`），由标准加载器挂载，零核心改动。
- 提取按文档顺序遍历 `[data-conversation-scroll]`，配对用户行（`[class*="_userRow"]` 气泡）与助手 markdown 容器（`[class*="_markdown_"]`）——标准渲染器的稳定 class 契约。
- 长图路径序列化干净克隆（显式 XHTML 命名空间、无离屏偏移）进 SVG `foreignObject`，用 `DOMParser` 校验后在 2x canvas 光栅化。外部图片先抓取内联；不可达的图片被丢弃而非污染画布。

## 已知限制

- 长图与 PDF 路径经 SVG `foreignObject` 光栅化（所有常青浏览器支持）；特殊嵌入内容可能被拍平。
- PDF 页面为光栅图像（文本不可选择）；需要可选中文本请用 Markdown 导出。
- 导出范围仅限当前对话列——侧边栏标题与设置页面不在范围内。

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
