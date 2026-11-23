//#region src/host/archive.ts
/**
* 折取档案摘要：压缩空白并截断至 96 字符（无内容时空串）。
* 与浏览器侧回合面板的 previewOf 同一纪律，宿主半独立实现。
*/
function archivePreview(text) {
	const flat = text.replace(/\s+/g, " ").trim();
	return flat.length > 96 ? `${flat.slice(0, 96)}…` : flat;
}
/**
* 从会话条目折取全局统计：会话数、总轮次、时间跨度。
* 纯函数，空档案返回零值。
*/
function buildArchiveStats(entries) {
	if (entries.length === 0) return {
		sessions: 0,
		turns: 0
	};
	let turns = 0;
	let firstAt = Number.POSITIVE_INFINITY;
	let lastAt = Number.NEGATIVE_INFINITY;
	for (const entry of entries) {
		turns += entry.turns;
		if (entry.createdAt < firstAt) firstAt = entry.createdAt;
		if (entry.createdAt > lastAt) lastAt = entry.createdAt;
	}
	return {
		sessions: entries.length,
		turns,
		firstAt,
		lastAt
	};
}
/** JSON 嵌入 <script> 前的安全转义（<\/script> 序列必须在字符串内断开）。 */
function escapeScriptJson(json) {
	return json.replace(/<\//g, "<\\/");
}
/**
* 生成 manifest.json 内容（机器可读索引：id → 文件名映射、轮次计数、
* 每会话摘要与全局统计）。version 2：新增 stats 与 preview 字段，
* 旧字段全部保留（纯增量，旧消费者不受影响）。
*/
function buildArchiveManifest(entries, meta) {
	return `${JSON.stringify({
		kind: "dsh-conv-export-archive",
		version: 2,
		exportedAt: meta.exportedAt,
		stats: buildArchiveStats(entries),
		sessions: entries
	}, null, 2)}\n`;
}
/**
* 生成自包含离线阅读器 index.html。
*
* 结构：<script type="application/json"> 携带全部会话数据（含 Markdown
* 源），内联 CSS + vanilla JS 渲染侧栏列表 / 主阅读区 / 即时搜索。
* @param sessions 全部导出会话（含 Markdown 源文本）。
* @param meta 导出元信息（时间戳展示用）。
*/
function buildArchiveViewerHtml(sessions, meta) {
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
<script id="dsh-archive" type="application/json">${escapeScriptJson(JSON.stringify(sessions))}<\/script>
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
<\/script>
</body>
</html>
`;
}
//#endregion
//#region src/host/http.ts
/** 带状态码的业务错误。 */
var HttpError = class extends Error {
	status;
	constructor(message, status = 400) {
		super(message);
		this.status = status;
		this.name = "HttpError";
	}
};
/**
* 创建路由器。
* @param basePath 前缀路径（默认 /conv-export）。
*/
function createRouter(basePath = "/conv-export") {
	const routes = /* @__PURE__ */ new Map();
	return {
		add(method, path, handler) {
			const key = `${method} ${path}`;
			if (routes.has(key)) throw new Error(`conv-export http: duplicate route ${key}`);
			routes.set(key, handler);
			return () => {
				if (routes.get(key) === handler) routes.delete(key);
			};
		},
		async handle(req, res) {
			let url;
			try {
				url = new URL(req.url ?? "/", "http://localhost");
			} catch {
				return sendJson(res, 400, { error: "bad request url" });
			}
			if (url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`)) return sendJson(res, 404, { error: "not found" });
			const sub = url.pathname.slice(basePath.length) || "/";
			const key = `${req.method ?? "GET"} ${sub}`;
			const handler = routes.get(key);
			if (!handler) return sendJson(res, 404, { error: `no route: ${key}` });
			try {
				const body = req.method === "GET" || req.method === "HEAD" ? void 0 : await readJsonBody(req);
				await handler(req, res, {
					query: url.searchParams,
					body
				});
			} catch (error) {
				try {
					if (error instanceof HttpError) sendJson(res, error.status, { error: error.message });
					else sendJson(res, 500, { error: error instanceof Error ? error.message : "internal error" });
				} catch {
					res.destroy();
				}
			}
		}
	};
}
/** 发送 JSON 响应。 */
function sendJson(res, status, payload) {
	if (res.writableEnded) return;
	if (res.headersSent) {
		res.end();
		return;
	}
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	});
	res.end(JSON.stringify(payload));
}
/** 请求体读取默认超时（毫秒）。 */
const BODY_READ_TIMEOUT_MS = 3e4;
/**
* 读取并解析 JSON 请求体（大小上限默认 8 MB；空正文返回 {}）。
* @param req 请求对象。
* @param limitBytes 大小上限（字节）。
* @param timeoutMs 读取超时（默认 30 秒）：慢速/停滞的 body 不会无限挂起，超时抛 408。
*/
async function readJsonBody(req, limitBytes = 8388608, timeoutMs = BODY_READ_TIMEOUT_MS) {
	const chunks = await new Promise((resolve, reject) => {
		const buffer = [];
		let size = 0;
		let settled = false;
		const timer = setTimeout(() => {
			fail(new HttpError("request body read timeout", 408));
			req.destroy();
		}, timeoutMs);
		const fail = (error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			reject(error);
		};
		req.on("data", (chunk) => {
			if (settled) return;
			size += chunk.byteLength;
			if (size > limitBytes) {
				fail(new HttpError("request body too large", 413));
				req.destroy();
				return;
			}
			buffer.push(chunk);
		});
		req.on("end", () => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(buffer);
		});
		req.on("error", (error) => fail(error));
		req.on("close", () => {
			fail(new HttpError("request body stream closed early", 400));
		});
	});
	if (chunks.length === 0) return {};
	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch {
		throw new HttpError("request body is not valid JSON", 400);
	}
}
//#endregion
//#region src/host/time.ts
/**
* 北京时间（UTC+8，无夏令时）工具（与 dsh-companion 的 core/time.ts
* 同源，仅保留批量导出所需的最小面）。批量 ZIP 文件名与 Markdown
* 元信息头的时间戳都以北京时间为准，与宿主机时区无关（CI/容器友好）。
*/
const BEIJING_OFFSET_MS = 288e5;
/** 北京时间日期键 YYYY-MM-DD。 */
function beijingDayKey(ts) {
	const d = new Date(ts + BEIJING_OFFSET_MS);
	return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
/** 北京时间格式化 YYYY-MM-DD HH:mm:ss。 */
function formatBeijingTime(ts) {
	const d = new Date(ts + BEIJING_OFFSET_MS);
	return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}
function pad2(n) {
	return n < 10 ? `0${n}` : String(n);
}
//#endregion
//#region src/host/transcript.ts
/**
* 会话转录：从 session-query 的原始日志快照派生人类可读对话文本，
* 并渲染为 Markdown（批量导出的条目内容）。
*
* 与 dsh-companion 的 core/transcript.ts 同源：Harness 会话是
* append-only 的类型化事件日志，这里只提取 `user/message` 与
* `assistant/message` 两类表面事件；提取后按 seq 稳定排序，防御
* 上游乱序。
*
* 注意：与单会话导出不同，批量条目由日志派生（原始文本 + 元信息头），
* 不经渲染 HTML 反向序列化——其他会话没有已渲染的 DOM 可读。
*/
/** 从日志事件折取最新标题（`session/title` 事件；无则空串）。 */
function titleFromLog(events) {
	let title = "";
	for (const event of events) if (event.type === "session/title") {
		const data = event.data;
		if (typeof data?.title === "string" && data.title.length > 0) title = data.title;
	}
	return title;
}
/** 从日志快照提取对话轮次（提取后按 seq 稳定排序，防御上游乱序）。 */
function transcriptFromLog(snapshot) {
	const turns = [];
	for (const event of snapshot.events) if (event.type === "user/message") {
		const data = event.data;
		const text = extractContentText(data?.content ?? event.data);
		if (text) turns.push({
			role: "user",
			text,
			time: event.time,
			seq: event.seq
		});
	} else if (event.type === "assistant/message") {
		const data = event.data;
		const text = extractContentText(data?.message?.content ?? data?.content);
		if (text) turns.push({
			role: "assistant",
			text,
			time: event.time,
			seq: event.seq
		});
	}
	turns.sort((a, b) => a.seq - b.seq);
	return turns;
}
/** 将消息 content（字符串或内容块数组）压平为纯文本。 */
function extractContentText(content) {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	const parts = [];
	for (const block of content) {
		if (!block || typeof block !== "object") continue;
		const b = block;
		if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
		else if (b.type === "tool_use") parts.push(`[工具调用${typeof b.name === "string" ? `：${b.name}` : ""}]`);
		else if (b.type === "tool_result") parts.push("[工具结果]");
	}
	return parts.join("\n");
}
/** 渲染为 Markdown 转录文本。 */
function formatTranscript(turns, options) {
	const lines = [];
	for (const turn of turns) {
		const speaker = turn.role === "user" ? "用户" : turn.role === "assistant" ? "助手" : turn.role;
		const stamp = options.timestamps ? `（${formatBeijingTime(turn.time)}）` : "";
		lines.push(`### ${speaker}${stamp}`, "", turn.text, "");
	}
	return lines.join("\n").trimEnd();
}
/** 完整的 Markdown 导出文档（含元信息头）。 */
function transcriptToMarkdown(session, turns, options) {
	return [
		...[
			`# ${session.title || "未命名对话"}`,
			"",
			`- 会话 ID：${session.id}`,
			`- 创建时间：${formatBeijingTime(session.createdAt)}`,
			`- 导出时间：${formatBeijingTime(Date.now())}`,
			`- 消息轮次：${turns.length}`,
			"",
			"---",
			""
		],
		formatTranscript(turns, options),
		""
	].join("\n");
}
//#endregion
//#region src/host/zip.ts
const CRC_TABLE = (() => {
	const table = /* @__PURE__ */ new Uint32Array(256);
	for (let n = 0; n < 256; n += 1) {
		let c = n;
		for (let k = 0; k < 8; k += 1) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();
function crc32(data) {
	let crc = 4294967295;
	for (let i = 0; i < data.byteLength; i += 1) crc = CRC_TABLE[(crc ^ data[i]) & 255] ^ crc >>> 8;
	return (crc ^ 4294967295) >>> 0;
}
/** 清理文件名中的非法字符，防止 ZIP 目录穿越。 */
function sanitizeFileName(name) {
	return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/^\.+/, "_").slice(0, 120) || "untitled";
}
/** ZIP（非 ZIP64）条目数上限：EOCD 计数字段为 16 位。 */
const MAX_ENTRIES = 65535;
/** ZIP（非 ZIP64）单条目字节上限：局部头/中心目录的长度字段为 32 位。 */
const MAX_ENTRY_BYTES = 4294967295;
/** 条目名编码器（模块级复用，避免每次打包重建）。 */
const encoder$1 = new TextEncoder();
/**
* 构建 ZIP 文件字节流。
*
* 单次分配：第一遍循环完成校验、文件名清理/编码与 CRC（并把中心目录
* 头写入暂存数组——每条目固定 46 字节，量级可忽略），累计精确总长后
* 第二遍直接写入唯一的目标缓冲区，无 concat、无逐块拷贝的中间数组。
* @param entries 条目列表（名称在内部统一经 sanitizeFileName 强制清理）。
* @returns 完整的 .zip 字节。
* @throws 条目数超过 65535，或单条目超过 4GB（不支持 ZIP64）。
*/
function buildZip(entries) {
	if (entries.length > MAX_ENTRIES) throw new Error(`zip: too many entries (${entries.length} > ${MAX_ENTRIES}); ZIP64 is not supported`);
	const localHeaders = [];
	const centralRecords = [];
	let offset = 0;
	let centralSize = 0;
	let total = 0;
	for (const entry of entries) {
		if (entry.data.byteLength > MAX_ENTRY_BYTES) throw new Error(`zip: entry "${entry.name}" exceeds the 4GB size limit; ZIP64 is not supported`);
		const nameBytes = encoder$1.encode(sanitizeFileName(entry.name));
		const crc = crc32(entry.data);
		const size = entry.data.byteLength;
		const local = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(30));
		local.setUint32(0, 67324752, true);
		local.setUint16(4, 20, true);
		local.setUint16(6, 2048, true);
		local.setUint16(8, 0, true);
		local.setUint16(10, 0, true);
		local.setUint16(12, 33, true);
		local.setUint32(14, crc, true);
		local.setUint32(18, size, true);
		local.setUint32(22, size, true);
		local.setUint16(26, nameBytes.byteLength, true);
		local.setUint16(28, 0, true);
		localHeaders.push(new Uint8Array(local.buffer), nameBytes);
		const central = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(46));
		central.setUint32(0, 33639248, true);
		central.setUint16(4, 20, true);
		central.setUint16(6, 20, true);
		central.setUint16(8, 2048, true);
		central.setUint16(10, 0, true);
		central.setUint16(12, 0, true);
		central.setUint16(14, 33, true);
		central.setUint32(16, crc, true);
		central.setUint32(20, size, true);
		central.setUint32(24, size, true);
		central.setUint16(28, nameBytes.byteLength, true);
		central.setUint32(42, offset, true);
		centralRecords.push(new Uint8Array(central.buffer), nameBytes);
		offset += 30 + nameBytes.byteLength + size;
		centralSize += 46 + nameBytes.byteLength;
		total += 30 + nameBytes.byteLength + size;
	}
	total += centralSize + 22;
	const out = new Uint8Array(total);
	const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
	let pos = 0;
	for (let i = 0; i < entries.length; i += 1) {
		out.set(localHeaders[2 * i], pos);
		pos += localHeaders[2 * i].byteLength;
		out.set(localHeaders[2 * i + 1], pos);
		pos += localHeaders[2 * i + 1].byteLength;
		out.set(entries[i].data, pos);
		pos += entries[i].data.byteLength;
	}
	for (const part of centralRecords) {
		out.set(part, pos);
		pos += part.byteLength;
	}
	view.setUint32(pos, 101010256, true);
	view.setUint16(pos + 8, entries.length, true);
	view.setUint16(pos + 10, entries.length, true);
	view.setUint32(pos + 12, centralSize, true);
	view.setUint32(pos + 16, offset, true);
	return out;
}
/** 文本编码器（条目内容统一 UTF-8）。 */
const encoder = new TextEncoder();
/**
* 解析 POST /conv-export/batch 的请求体 sessionIds 字段。
* @throws 形状不符（非对象 / 非数组 / 空数组 / 含非字符串项）→ 400。
*/
function parseSessionIds(body) {
	if (typeof body !== "object" || body === null || Array.isArray(body)) throw new HttpError("请求体必须是 JSON 对象");
	const raw = body.sessionIds;
	if (!Array.isArray(raw) || raw.length === 0) throw new HttpError("sessionIds 必填且必须为非空数组");
	const ids = [];
	for (const item of raw) {
		if (typeof item !== "string" || item.trim().length === 0) throw new HttpError("sessionIds 必须全部为非空字符串");
		ids.push(item.trim());
	}
	return ids;
}
/**
* 将 listSessions 的原始返回归一化为扁平会话头（浏览器面板契约）。
*
* 兼容两种上游形状：扁平头（dev 桩 / 旧适配层）与真实宿主的嵌套记录
* `{ header, live, persisted }`；形状不合法的条目静默跳过（防御性，
* 不让个别坏记录拖垮整个列表）。
*/
function normalizeSessionHeaders(records) {
	const out = [];
	for (const record of records) {
		if (typeof record !== "object" || record === null) continue;
		const r = record;
		const nested = r.header;
		const source = typeof r.id === "string" ? r : typeof nested?.id === "string" ? nested : void 0;
		if (source === void 0 || typeof source.id !== "string") continue;
		const header = {
			id: source.id,
			createdAt: typeof source.createdAt === "number" ? source.createdAt : 0
		};
		if (typeof source.title === "string" && source.title.length > 0) header.title = source.title;
		if (typeof source.updatedAt === "number") header.updatedAt = source.updatedAt;
		out.push(header);
	}
	return out;
}
/**
* 尽力而为的标题补全：真实宿主的标题在日志 `session/title` 事件里，
* listSessions 的头不含标题。服务提供 readTitleSnapshots 时按输入
* 顺序折取标题写入对应会话头；任何失败静默忽略（标题缺失可降级，
* 列表本身不受影响）。
*/
async function enrichSessionTitles(sessionQuery, sessions) {
	if (sessions.length === 0 || typeof sessionQuery.readTitleSnapshots !== "function") return;
	let results;
	try {
		results = await sessionQuery.readTitleSnapshots(sessions.map((s) => s.id));
	} catch {
		return;
	}
	let index = 0;
	for (const result of results) {
		const session = sessions[index];
		index += 1;
		if (session === void 0 || typeof result !== "object" || result === null) continue;
		const r = result;
		if (r.status !== "fulfilled" || typeof r.value?.title !== "object" || r.value.title === null) continue;
		const snapshot = r.value.title;
		if (typeof snapshot.title === "string" && snapshot.title.length > 0) session.title = snapshot.title;
		if (typeof snapshot.updatedAt === "number") session.updatedAt = snapshot.updatedAt;
	}
}
/**
* 批量导出多个会话并打包为 Markdown ZIP。
* @param sessionQuery 会话查询服务（对宿主的唯一依赖）。
* @param sessionIds 会话 id 列表：先经 Set 去重，去重后数量不得超过
* MAX_BATCH_SESSIONS；单个会话读取失败会被跳过并计入 skipped，
* 系统性错误（ZIP 组装等）上抛。
*/
async function buildBatchZip(sessionQuery, sessionIds) {
	if (sessionIds.length === 0) throw new HttpError("sessionIds 不能为空", 400);
	const uniqueIds = [...new Set(sessionIds)];
	if (uniqueIds.length > 100) throw new HttpError(`批量导出一次最多支持 100 个会话`, 400);
	const slots = new Array(uniqueIds.length).fill(null);
	let skipped = 0;
	let next = 0;
	const workers = Array.from({ length: Math.min(4, uniqueIds.length) }, async () => {
		for (;;) {
			const index = next;
			next += 1;
			if (index >= uniqueIds.length) return;
			const sessionId = uniqueIds[index];
			try {
				const snapshot = await sessionQuery.readSession(sessionId);
				const session = snapshot.session;
				const turns = transcriptFromLog(snapshot);
				const title = session.title || titleFromLog(snapshot.events);
				const header = title === "" ? session : {
					...session,
					title
				};
				const name = `${sanitizeFileName(title || session.id)}.md`;
				const markdown = transcriptToMarkdown(header, turns, { timestamps: true });
				const firstUser = turns.find((turn) => turn.role === "user");
				slots[index] = {
					entry: {
						name,
						data: encoder.encode(markdown)
					},
					archive: {
						id: session.id,
						title: title || session.id,
						createdAt: session.createdAt,
						...typeof session.updatedAt === "number" ? { updatedAt: session.updatedAt } : {},
						turnCount: turns.length,
						preview: archivePreview(firstUser?.text ?? ""),
						markdown
					}
				};
			} catch {
				skipped += 1;
			}
		}
	});
	await Promise.all(workers);
	const entries = [];
	const manifest = [];
	const archiveSessions = [];
	const usedNames = /* @__PURE__ */ new Set();
	for (const slot of slots) {
		if (slot === null) continue;
		const name = uniqueEntryName(usedNames, slot.entry.name);
		entries.push({
			name,
			data: slot.entry.data
		});
		manifest.push({
			id: slot.archive.id,
			title: slot.archive.title,
			createdAt: slot.archive.createdAt,
			...slot.archive.updatedAt !== void 0 ? { updatedAt: slot.archive.updatedAt } : {},
			turns: slot.archive.turnCount,
			preview: slot.archive.preview,
			file: name
		});
		archiveSessions.push(slot.archive);
	}
	if (entries.length === 0) throw new HttpError("没有可导出的会话", 404);
	const exportedAt = Date.now();
	entries.push({
		name: "manifest.json",
		data: encoder.encode(buildArchiveManifest(manifest, { exportedAt }))
	});
	entries.push({
		name: "index.html",
		data: encoder.encode(buildArchiveViewerHtml(archiveSessions, { exportedAt }))
	});
	return {
		fileName: `dsh-conversations-${beijingDayKey(Date.now())}.zip`,
		bytes: buildZip(entries),
		skipped
	};
}
/**
* 将错误收敛为用户安全的 HttpError：
* HttpError 原样透传；其余错误以通用文案包装，避免泄漏内部细节。
*/
function toSafeHttpError(error, fallbackMessage) {
	if (error instanceof HttpError) return error;
	return new HttpError(fallbackMessage, 500);
}
/** ZIP 条目名去重：重名时在扩展名前插入 -2/-3… 序号，防止覆盖。 */
function uniqueEntryName(used, name) {
	if (!used.has(name)) {
		used.add(name);
		return name;
	}
	const dot = name.lastIndexOf(".");
	const stem = dot > 0 ? name.slice(0, dot) : name;
	const ext = dot > 0 ? name.slice(dot) : "";
	for (let suffix = 2;; suffix += 1) {
		const candidate = `${stem}-${suffix}${ext}`;
		if (!used.has(candidate)) {
			used.add(candidate);
			return candidate;
		}
	}
}
//#endregion
//#region src/index.ts
/** Stable Cordis plugin name (matches the manifest id). */
const name = "@dsh-external/dsh-conv-export";
/** 依赖服务：同源路由挂载点与会话查询（批量导出专用，只读）。 */
const inject = ["webServer", "sessionQuery"];
/**
* 宿主入口：注册 /conv-export 前缀路由与两个批量导出端点。
* 全部注册经 ctx.effect，随插件卸载自动回卷；错误一律收敛为
* HttpError，不泄漏内部细节。
* @param ctx - host root context（经 inject 提供 webServer / sessionQuery）。
*/
function apply(ctx) {
	const router = createRouter("/conv-export");
	ctx.effect(() => {
		const disposers = [
			ctx.webServer.register({
				kind: "prefix",
				path: "/conv-export",
				handler: (req, res) => router.handle(req, res)
			}),
			router.add("GET", "/sessions", async (_req, res) => {
				try {
					const sessions = normalizeSessionHeaders(await ctx.sessionQuery.listSessions());
					await enrichSessionTitles(ctx.sessionQuery, sessions);
					sendJson(res, 200, { sessions });
				} catch (error) {
					throw toSafeHttpError(error, "获取会话列表失败");
				}
			}),
			router.add("POST", "/batch", async (_req, res, hctx) => {
				try {
					const sessionIds = parseSessionIds(hctx.body);
					const result = await buildBatchZip(ctx.sessionQuery, sessionIds);
					sendJson(res, 200, {
						kind: "file",
						fileName: result.fileName,
						mimeType: "application/zip",
						contentBase64: toBase64(result.bytes)
					});
				} catch (error) {
					throw toSafeHttpError(error, "批量导出失败");
				}
			})
		];
		return () => {
			for (const dispose of [...disposers].reverse()) dispose();
		};
	}, "dsh-conv-export: host routes");
}
/** 字节内容 base64 编码（HTTP 响应中字节一律 base64）。 */
function toBase64(bytes) {
	return Buffer.from(bytes).toString("base64");
}
//#endregion
export { apply, inject, name };
