/**
 * 批量导出服务函数（HTTP 端点与未来的命令面板共用）。
 *
 * 语义对齐 dsh-companion 模块 A 的批量纪律：
 * - sessionIds 先去重，去重后超过 MAX_BATCH_SESSIONS（100）→ 400；
 * - 单会话读取/渲染失败跳过并计数（其余照常入包），循环外的系统性错误上抛；
 * - 条目重名经 -2/-3 后缀去重；全部失败 → 404；
 * - 条目为日志派生的 Markdown（含元信息头与时间戳，见 ./transcript.ts）。
 */
import { archivePreview, buildArchiveManifest, buildArchiveViewerHtml, type ArchiveManifestEntry, type ArchiveSessionData } from './archive.ts'
import { HttpError } from './http.ts'
import { beijingDayKey } from './time.ts'
import { titleFromLog, transcriptFromLog, transcriptToMarkdown } from './transcript.ts'
import type { SessionListRecord, SessionQueryEngine } from './types.ts'
import { buildZip, sanitizeFileName, type ZipEntry } from './zip.ts'

/** 批量导出会话数上限（去重后计数）。 */
export const MAX_BATCH_SESSIONS = 100

/**
 * 批量读取并发度：真实宿主的 readSession 是持久化 IO（zstd 解压 +
 * 重放校验），串行时 100 会话约数秒。与 dsh-session-query 自身的
 * persistedInspectConcurrency（默认 4）对齐——并发读取互不依赖，
 * 输出顺序由结果槽位保证，与完成顺序无关。
 */
export const READ_CONCURRENCY = 4

/** 文本编码器（条目内容统一 UTF-8）。 */
const encoder = new TextEncoder()

/** 批量导出结果（字节未 base64，HTTP 层负责编码）。 */
export interface BatchZipResult {
  fileName: string
  bytes: Uint8Array
  /** 读取失败被跳过的会话数。 */
  skipped: number
}

/**
 * 解析 POST /conv-export/batch 的请求体 sessionIds 字段。
 * @throws 形状不符（非对象 / 非数组 / 空数组 / 含非字符串项）→ 400。
 */
export function parseSessionIds(body: unknown): string[] {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new HttpError('请求体必须是 JSON 对象')
  }
  const raw = (body as Record<string, unknown>).sessionIds
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new HttpError('sessionIds 必填且必须为非空数组')
  }
  const ids: string[] = []
  for (const item of raw as readonly unknown[]) {
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new HttpError('sessionIds 必须全部为非空字符串')
    }
    ids.push(item.trim())
  }
  return ids
}

/** 可变会话头（归一化产物；标题补全阶段就地写入）。 */
type MutableSessionHeader = { id: string; title?: string; createdAt: number; updatedAt?: number }

/**
 * 将 listSessions 的原始返回归一化为扁平会话头（浏览器面板契约）。
 *
 * 兼容两种上游形状：扁平头（dev 桩 / 旧适配层）与真实宿主的嵌套记录
 * `{ header, live, persisted }`；形状不合法的条目静默跳过（防御性，
 * 不让个别坏记录拖垮整个列表）。
 */
export function normalizeSessionHeaders(records: readonly SessionListRecord[]): MutableSessionHeader[] {
  const out: MutableSessionHeader[] = []
  for (const record of records) {
    if (typeof record !== 'object' || record === null) continue
    const r = record as Record<string, unknown>
    const nested = r.header as Record<string, unknown> | undefined
    const source = typeof r.id === 'string' ? r
      : typeof nested?.id === 'string' ? nested
      : undefined
    if (source === undefined || typeof source.id !== 'string') continue
    const header: MutableSessionHeader = {
      id: source.id,
      createdAt: typeof source.createdAt === 'number' ? source.createdAt : 0,
    }
    if (typeof source.title === 'string' && source.title.length > 0) header.title = source.title
    if (typeof source.updatedAt === 'number') header.updatedAt = source.updatedAt
    out.push(header)
  }
  return out
}

/**
 * 尽力而为的标题补全：真实宿主的标题在日志 `session/title` 事件里，
 * listSessions 的头不含标题。服务提供 readTitleSnapshots 时按输入
 * 顺序折取标题写入对应会话头；任何失败静默忽略（标题缺失可降级，
 * 列表本身不受影响）。
 */
export async function enrichSessionTitles(
  sessionQuery: SessionQueryEngine,
  sessions: MutableSessionHeader[],
): Promise<void> {
  if (sessions.length === 0 || typeof sessionQuery.readTitleSnapshots !== 'function') return
  let results: readonly unknown[]
  try {
    results = await sessionQuery.readTitleSnapshots(sessions.map(s => s.id))
  } catch {
    return
  }
  let index = 0
  for (const result of results) {
    const session = sessions[index]
    index += 1
    if (session === undefined || typeof result !== 'object' || result === null) continue
    const r = result as { status?: unknown; value?: { title?: { title?: unknown; updatedAt?: unknown } } }
    if (r.status !== 'fulfilled' || typeof r.value?.title !== 'object' || r.value.title === null) continue
    const snapshot = r.value.title
    if (typeof snapshot.title === 'string' && snapshot.title.length > 0) session.title = snapshot.title
    if (typeof snapshot.updatedAt === 'number') session.updatedAt = snapshot.updatedAt
  }
}

/**
 * 批量导出多个会话并打包为 Markdown ZIP。
 * @param sessionQuery 会话查询服务（对宿主的唯一依赖）。
 * @param sessionIds 会话 id 列表：先经 Set 去重，去重后数量不得超过
 * MAX_BATCH_SESSIONS；单个会话读取失败会被跳过并计入 skipped，
 * 系统性错误（ZIP 组装等）上抛。
 */
export async function buildBatchZip(
  sessionQuery: SessionQueryEngine,
  sessionIds: readonly string[],
): Promise<BatchZipResult> {
  if (sessionIds.length === 0) throw new HttpError('sessionIds 不能为空', 400)
  // 去重：避免同一会话被重复导出打包。
  const uniqueIds = [...new Set(sessionIds)]
  if (uniqueIds.length > MAX_BATCH_SESSIONS) {
    throw new HttpError(`批量导出一次最多支持 ${MAX_BATCH_SESSIONS} 个会话`, 400)
  }

  // 受控并发读取 + 渲染：结果写入与下标绑定的槽位，输出顺序与输入
  // 一致（与完成顺序无关）；单会话失败仅置空该槽位（计 skipped），
  // 不影响其余会话。同时汇出档案数据（阅读器 / manifest 消费）。
  const slots: Array<{ entry: ZipEntry; archive: ArchiveSessionData } | null> = new Array(uniqueIds.length).fill(null)
  let skipped = 0
  let next = 0
  const workers = Array.from(
    { length: Math.min(READ_CONCURRENCY, uniqueIds.length) },
    async () => {
      for (;;) {
        const index = next
        next += 1
        if (index >= uniqueIds.length) return
        const sessionId = uniqueIds[index]!
        try {
          const snapshot = await sessionQuery.readSession(sessionId)
          const session = snapshot.session
          const turns = transcriptFromLog(snapshot)
          // 标题优先级：头自带（旧适配层）→ 日志 session/title 事件（真实宿主）→ 会话 id。
          const title = session.title || titleFromLog(snapshot.events)
          const header = title === '' ? session : { ...session, title }
          const base = sanitizeFileName(title || session.id)
          const name = `${base}.md`
          const markdown = transcriptToMarkdown(header, turns, { timestamps: true })
          // 智能档案层摘要：首条用户消息（无则空串），侧栏/manifest 不点开即知主题。
          const firstUser = turns.find(turn => turn.role === 'user')
          slots[index] = {
            entry: { name, data: encoder.encode(markdown) },
            archive: {
              id: session.id,
              title: title || session.id,
              createdAt: session.createdAt,
              ...(typeof session.updatedAt === 'number' ? { updatedAt: session.updatedAt } : {}),
              turnCount: turns.length,
              preview: archivePreview(firstUser?.text ?? ''),
              markdown,
            },
          }
        } catch {
          skipped += 1
        }
      }
    },
  )
  await Promise.all(workers)

  // 条目名去重放在顺序确定之后（-2/-3 后缀按输入顺序分配，跨并发稳定）。
  const entries: ZipEntry[] = []
  const manifest: ArchiveManifestEntry[] = []
  const archiveSessions: ArchiveSessionData[] = []
  const usedNames = new Set<string>()
  for (const slot of slots) {
    if (slot === null) continue
    const name = uniqueEntryName(usedNames, slot.entry.name)
    entries.push({ name, data: slot.entry.data })
    manifest.push({
      id: slot.archive.id,
      title: slot.archive.title,
      createdAt: slot.archive.createdAt,
      ...(slot.archive.updatedAt !== undefined ? { updatedAt: slot.archive.updatedAt } : {}),
      turns: slot.archive.turnCount,
      preview: slot.archive.preview,
      file: name,
    })
    archiveSessions.push(slot.archive)
  }
  if (entries.length === 0) throw new HttpError('没有可导出的会话', 404)

  // 便携档案层（创新）：阅读器 + 机器可读索引随 ZIP 一起分发——
  // 解压即得离线可搜索的会话档案馆。会话条目均以 .md 结尾，
  // 与 index.html / manifest.json 无命名冲突。
  const exportedAt = Date.now()
  entries.push({ name: 'manifest.json', data: encoder.encode(buildArchiveManifest(manifest, { exportedAt })) })
  entries.push({ name: 'index.html', data: encoder.encode(buildArchiveViewerHtml(archiveSessions, { exportedAt })) })

  return {
    fileName: `dsh-conversations-${beijingDayKey(Date.now())}.zip`,
    bytes: buildZip(entries),
    skipped,
  }
}

/**
 * 将错误收敛为用户安全的 HttpError：
 * HttpError 原样透传；其余错误以通用文案包装，避免泄漏内部细节。
 */
export function toSafeHttpError(error: unknown, fallbackMessage: string): HttpError {
  if (error instanceof HttpError) return error
  return new HttpError(fallbackMessage, 500)
}

/** ZIP 条目名去重：重名时在扩展名前插入 -2/-3… 序号，防止覆盖。 */
function uniqueEntryName(used: Set<string>, name: string): string {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${stem}-${suffix}${ext}`
    if (!used.has(candidate)) {
      used.add(candidate)
      return candidate
    }
  }
}
