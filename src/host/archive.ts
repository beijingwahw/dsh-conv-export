/**
 * 便携档案阅读器（批量导出的创新层）。
 *
 * 批量导出的 ZIP 不再只是一堆 .md 文件：额外内嵌一个 `index.html`
 * 离线阅读器 + `manifest.json` 机器可读索引——
 * - 双击 index.html 即可浏览全部导出会话（无需服务器、无需解压工具，
 *   file:// 协议直接工作）；
 * - 内置即时全文搜索（标题 + 正文，客户端过滤，零依赖零网络）；
 * - 每个会话可在线阅读（角色徽章 + 时间戳）、一键复制 Markdown、
 *   一键下载 .md（Blob 重建，离线可用）；
 * - 明暗主题自动跟随系统。
 *
 * 纯函数生成（buildArchiveViewerHtml / buildArchiveManifest），
 * 全部数据以 JSON 嵌入单个 HTML——档案馆即文件，文件即档案馆。
 */

/** 档案阅读器消费的单会话数据（由 buildBatchZip 汇出）。 */
export interface ArchiveSessionData {
  readonly id: string
  readonly title: string
  readonly createdAt: number
  readonly updatedAt?: number
  readonly turnCount: number
  /** 首条用户消息的摘要（不点开即知会话主题；无则空串）。 */
  readonly preview: string
  /** 该会话的完整 Markdown 源文本（与 ZIP 内 .md 条目逐字节一致）。 */
  readonly markdown: string
}

/** manifest.json 的机器可读索引条目。 */
export interface ArchiveManifestEntry {
  readonly id: string
  readonly title: string
  readonly createdAt: number
  readonly updatedAt?: number
  readonly turns: number
  /** 首条用户消息的摘要（与阅读器一致，便于外部工具直接展示）。 */
  readonly preview?: string
  /** ZIP 内对应的 Markdown 条目名。 */
  readonly file: string
}

/** 档案全局统计（manifest.stats 与阅读器统计条共同消费）。 */
export interface ArchiveStats {
  readonly sessions: number
  readonly turns: number
  /** 最早创建时间（无会话时缺省）。 */
  readonly firstAt?: number
  /** 最晚创建时间（无会话时缺省）。 */
  readonly lastAt?: number
}

/**
 * 折取档案摘要：压缩空白并截断至 96 字符（无内容时空串）。
 * 与浏览器侧回合面板的 previewOf 同一纪律，宿主半独立实现。
 */
export function archivePreview(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > 96 ? `${flat.slice(0, 96)}…` : flat
}

/**
 * 从会话条目折取全局统计：会话数、总轮次、时间跨度。
 * 纯函数，空档案返回零值。
 */
export function buildArchiveStats(entries: readonly ArchiveManifestEntry[]): ArchiveStats {
  if (entries.length === 0) return { sessions: 0, turns: 0 }
  let turns = 0
  let firstAt = Number.POSITIVE_INFINITY
  let lastAt = Number.NEGATIVE_INFINITY
  for (const entry of entries) {
    turns += entry.turns
    if (entry.createdAt < firstAt) firstAt = entry.createdAt
    if (entry.createdAt > lastAt) lastAt = entry.createdAt
  }
  return { sessions: entries.length, turns, firstAt, lastAt }
}

/** JSON 嵌入 <script> 前的安全转义（</script> 序列必须在字符串内断开）。 */
function escapeScriptJson(json: string): string {
  return json.replace(/<\//g, '<\\/')
}

/**
 * 生成 manifest.json 内容（机器可读索引：id → 文件名映射、轮次计数、
 * 每会话摘要与全局统计）。version 2：新增 stats 与 preview 字段，
 * 旧字段全部保留（纯增量，旧消费者不受影响）。
 */
export function buildArchiveManifest(
  entries: readonly ArchiveManifestEntry[],
  meta: { exportedAt: number },
): string {
  return `${JSON.stringify(
    {
      kind: 'dsh-conv-export-archive',
      version: 2,
      exportedAt: meta.exportedAt,
      stats: buildArchiveStats(entries),
      sessions: entries,
    },
    null,
    2,
  )}\n`
}

/**
 * 生成自包含离线阅读器 index.html。
 *
 * 结构：<script type="application/json"> 携带全部会话数据（含 Markdown
 * 源），内联 CSS + vanilla JS 渲染侧栏列表 / 主阅读区 / 即时搜索。
 * @param sessions 全部导出会话（含 Markdown 源文本）。
 * @param meta 导出元信息（时间戳展示用）。
 */
export function buildArchiveViewerHtml(
  sessions: readonly ArchiveSessionData[],
  meta: { exportedAt: number },
): string {
  const payload = escapeScriptJson(JSON.stringify(sessions))
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DSH 会话档案馆</title>
<style>
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", sans-serif;
  background: #f6f7f9; color: #1f2328; display: flex; height: 100vh; }
@media (prefers-color-scheme: dark) {
  body { background: #0d1117; color: #e6edf3; }
  .side, .paper { background: #161b22; }
  .grp { background: #161b22; color: #8b949e; border-bottom-color: #21262d; }
  .item { border-bottom-color: #21262d; }
  .turn.user .bubble { background: #1c2a4a; }
  .turn.assistant .bubble { background: #143427; }
  input, button { background: #21262d; color: #e6edf3; border-color: #30363d; }
}
.side { width: 300px; min-width: 260px; background: #fff; border-right: 1px solid #d0d7de;
  display: flex; flex-direction: column; }
.side header { padding: 12px 14px 8px; font-weight: 600; font-size: 15px; }
.side .meta { padding: 0 14px 8px; font-size: 12px; opacity: .65; }
.side input { margin: 0 14px 10px; padding: 8px 10px; border: 1px solid #d0d7de;
  border-radius: 8px; font-size: 13px; outline: none; }
.side input:focus { border-color: #4c8dff; box-shadow: 0 0 0 3px rgba(76,141,255,.18); }
.list { overflow-y: auto; flex: 1; }
.grp { position: sticky; top: 0; z-index: 1; padding: 6px 14px 5px; font-size: 11px;
  font-weight: 600; letter-spacing: .04em; color: #57606a; background: #fff;
  border-bottom: 1px solid #eaeef2; }
.item { padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #eaeef2; }
.item:hover { background: rgba(76,141,255,.07); }
.item.active { background: rgba(76,141,255,.14); }
.item .t { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item .p { font-size: 11.5px; opacity: .62; margin-top: 3px; line-height: 1.45;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.item .d { font-size: 11px; opacity: .6; margin-top: 3px; }
.item mark { background: #ffe08a; color: inherit; border-radius: 2px; }
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.bar { padding: 10px 18px; display: flex; gap: 8px; align-items: center; justify-content: flex-end; }
button { padding: 6px 12px; font-size: 13px; border: 1px solid #d0d7de; border-radius: 8px; cursor: pointer; }
button:hover { border-color: #4c8dff; color: #4c8dff; }
.paper { flex: 1; overflow-y: auto; background: #fff; border-radius: 10px;
  margin: 0 18px 18px; padding: 22px 26px; }
.paper h1 { font-size: 20px; margin: 0 0 4px; }
.paper .sub { font-size: 12px; opacity: .6; margin-bottom: 18px; }
.turn { margin: 14px 0; display: flex; }
.turn .who { font-size: 12px; font-weight: 600; width: 64px; padding-top: 8px; flex: none; }
.turn.user .who { color: #3b82f6; }
.turn.assistant .who { color: #22a06b; }
.turn .bubble { flex: 1; border-radius: 10px; padding: 10px 14px; background: #f0f3f6;
  white-space: pre-wrap; word-break: break-word; font-size: 14px; line-height: 1.65; }
.turn.user .bubble { background: #e8f0fe; }
.turn.assistant .bubble { background: #e6f4ec; }
.paper .raw { display: none; white-space: pre-wrap; font-family: ui-monospace, monospace;
  font-size: 13px; line-height: 1.6; }
.paper.rawview .turns { display: none; }
.paper.rawview .raw { display: block; }
.empty { display: flex; height: 100%; align-items: center; justify-content: center; opacity: .5; }
kbd { font-family: ui-monospace, monospace; font-size: 11px; border: 1px solid #d0d7de;
  border-radius: 4px; padding: 1px 5px; }
</style>
</head>
<body>
<aside class="side">
  <header>📚 会话档案馆</header>
  <div class="meta" id="meta"></div>
  <input id="q" type="search" placeholder="搜索标题与正文…（按 / 聚焦）" autocomplete="off">
  <div class="list" id="list"></div>
</aside>
<main class="main">
  <div class="bar">
    <button id="toggle" title="切换 渲染视图 / Markdown 源码">Markdown</button>
    <button id="copy">复制 Markdown</button>
    <button id="save">下载 .md</button>
  </div>
  <div class="paper" id="paper"><div class="empty">从左侧选择一个会话</div></div>
</main>
<script id="dsh-archive" type="application/json">${payload}</script>
<script>
(function () {
  'use strict'
  var SESSIONS = JSON.parse(document.getElementById('dsh-archive').textContent)
  var q = document.getElementById('q'), list = document.getElementById('list')
  var paper = document.getElementById('paper'), meta = document.getElementById('meta')
  var current = -1, query = ''

  function fmt(ts) {
    var d = new Date(ts)
    function p(n) { return n < 10 ? '0' + n : '' + n }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
  }
  // 日期分组键（本地时区）：时间线侧栏按创建日聚合会话。
  function dayKey(ts) {
    var d = new Date(ts)
    function p(n) { return n < 10 ? '0' + n : '' + n }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
  }
  // 从嵌入的 Markdown 源解析轮次（渲染视图用；无需完整 Markdown 引擎）。
  function turnsOf(md) {
    var out = [], lines = md.split('\\n'), role = '', buf = []
    function flush() {
      if (role) out.push({ role: role, text: buf.join('\\n').trim() })
      buf = []
    }
    for (var i = 0; i < lines.length; i++) {
      var m = /^### (用户|助手)（/.exec(lines[i])
      if (m) { flush(); role = m[1] === '用户' ? 'user' : 'assistant'; continue }
      if (/^---$/.test(lines[i].trim())) continue
      if (role) buf.push(lines[i])
    }
    flush()
    return out
  }
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  function hl(s) {
    var e = esc(s)
    if (!query) return e
    try {
      return e.replace(new RegExp(query.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'gi'), function (m) {
        return '<mark>' + m + '</mark>'
      })
    } catch (err) { return e }
  }

  function filtered() {
    if (!query) return SESSIONS
    var needle = query.toLowerCase()
    return SESSIONS.filter(function (s) {
      return (s.title + '\\n' + s.markdown).toLowerCase().indexOf(needle) >= 0
    })
  }

  function renderList() {
    var items = filtered()
    list.innerHTML = ''
    if (items.length === 0) {
      var none = document.createElement('div')
      none.className = 'grp'
      none.textContent = query ? '没有匹配的会话' : '暂无会话'
      list.appendChild(none)
      return
    }
    var lastDay = ''
    items.forEach(function (s) {
      var day = dayKey(s.createdAt)
      if (day !== lastDay) {
        lastDay = day
        var grp = document.createElement('div')
        grp.className = 'grp'
        grp.textContent = day
        list.appendChild(grp)
      }
      var div = document.createElement('div')
      div.className = 'item' + (SESSIONS.indexOf(s) === current ? ' active' : '')
      var title = s.title || s.id
      var hit = query && s.markdown.toLowerCase().indexOf(query.toLowerCase()) >= 0 && title.toLowerCase().indexOf(query.toLowerCase()) < 0
      var inner = '<div class="t">' + hl(title) + '</div>'
      if (s.preview) inner += '<div class="p">' + hl(s.preview) + '</div>'
      inner += '<div class="d">' + fmt(s.createdAt) + ' · ' + s.turnCount + ' 轮' + (hit ? ' · 正文命中' : '') + '</div>'
      div.innerHTML = inner
      div.onclick = function () { open(SESSIONS.indexOf(s)) }
      list.appendChild(div)
    })
  }

  function open(i) {
    current = i
    var s = SESSIONS[i]
    paper.classList.remove('rawview')
    var turns = turnsOf(s.markdown)
    var html = '<h1>' + esc(s.title || s.id) + '</h1><div class="sub">ID ' + esc(s.id) +
      ' · 创建 ' + fmt(s.createdAt) + ' · ' + s.turnCount + ' 轮对话</div><div class="turns">'
    turns.forEach(function (t) {
      html += '<div class="turn ' + t.role + '"><div class="who">' +
        (t.role === 'user' ? '用户' : '助手') + '</div><div class="bubble">' + esc(t.text) + '</div></div>'
    })
    html += '</div><div class="raw">' + esc(s.markdown) + '</div>'
    paper.innerHTML = html
    renderList()
  }

  // 智能统计条：会话数 · 总轮次 · 时间跨度 · 导出时间（现场折取，零外部依赖）。
  var totalTurns = 0, firstAt = Infinity, lastAt = -Infinity
  SESSIONS.forEach(function (s) {
    totalTurns += s.turnCount
    if (s.createdAt < firstAt) firstAt = s.createdAt
    if (s.createdAt > lastAt) lastAt = s.createdAt
  })
  var span = SESSIONS.length === 0 ? '' : dayKey(firstAt) === dayKey(lastAt)
    ? dayKey(firstAt) : dayKey(firstAt) + ' → ' + dayKey(lastAt)
  meta.textContent = SESSIONS.length + ' 个会话 · ' + totalTurns + ' 轮' +
    (span ? ' · ' + span : '') + ' · 导出于 ' + fmt(${String(meta.exportedAt)})
  q.addEventListener('input', function () { query = q.value.trim(); current = -1; renderList() })
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q.focus() }
  })
  document.getElementById('toggle').onclick = function () { paper.classList.toggle('rawview') }
  document.getElementById('copy').onclick = function () {
    if (current < 0) return
    navigator.clipboard.writeText(SESSIONS[current].markdown)
    var b = this; b.textContent = '已复制 ✓'
    setTimeout(function () { b.textContent = '复制 Markdown' }, 1200)
  }
  document.getElementById('save').onclick = function () {
    if (current < 0) return
    var s = SESSIONS[current], a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([s.markdown], { type: 'text/markdown' }))
    a.download = (s.title || s.id).replace(/[\\\\/:*?"<>|]/g, '_') + '.md'
    a.click()
    setTimeout(function () { URL.revokeObjectURL(a.href) }, 4000)
  }
  renderList()
})()
</script>
</body>
</html>
`
}
