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
  - **PDF（打印）**——打开干净的打印窗（排版样式、打印边距），由浏览器"另存为 PDF"完成。
  - **长图 (PNG)**——离屏渲染测量后经 SVG `foreignObject` 以 2x 光栅化，图片内联为 data URL，下载为一张长 PNG（高度上限 16000px）。
- **合理的文件名**取自会话标题（净化、限长）；每个产物含导出时间戳行。
- 跟随 Harness `--dsw-alias-*` 设计令牌；菜单文案按文档语言自动切换中/英文。
- 菜单卫生：Escape 或点击外部关闭；长图光栅失败时给出 toast 提示。

## 安装

需要 Node.js ≥ 22 与 pnpm（`npm install -g pnpm`）——`dsh plugin add` 通过 pnpm 把 bundle 装入 profile。

```sh
dsh plugin --profile web add https://github.com/beijingwahw/dsh-conv-export/archive/refs/heads/main.tar.gz
dsh web   # 重启服务以加载插件
```

## 使用

打开任意对话，点击会话头部的下载图标，选择格式。Markdown/PNG 立即下载；PDF 在新窗口打开打印对话框。

## 实现原理

- 宿主半边是空的 cordis 注册外壳；全部行为位于浏览器 bundle（`lib/client.js`），由标准加载器挂载，零核心改动。
- 提取按文档顺序遍历 `[data-conversation-scroll]`，配对用户行（`[class*="_userRow"]` 气泡）与助手 markdown 容器（`[class*="_markdown_"]`）——标准渲染器的稳定 class 契约。
- 长图路径序列化干净克隆（显式 XHTML 命名空间、无离屏偏移）进 SVG `foreignObject`，用 `DOMParser` 校验后在 2x canvas 光栅化。外部图片先抓取内联；不可达的图片被丢弃而非污染画布。

## 已知限制

- 长图光栅化依赖浏览器绘制 SVG `foreignObject`（所有常青浏览器支持）；特殊嵌入内容可能被拍平。
- PDF 经浏览器打印对话框（"另存为 PDF"）产出——不内置服务端 PDF 引擎。
- 导出范围仅限当前对话列——侧边栏标题与设置页面不在范围内。

## 排障

- `dsh plugin add` 时报 `'pnpm' 不是内部或外部命令` → 先安装 pnpm：`npm install -g pnpm`。
- `dsh web` 报 `EADDRINUSE ... :3080` → 上一个 `dsh web` 仍占用端口。在其终端按 Ctrl+C 停掉；Windows 可用 `Get-NetTCPConnection -LocalPort 3080 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`，或换端口启动：`dsh web --port 3081`。

## 许可证

MIT
