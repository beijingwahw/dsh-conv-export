/**
 * 宿主批量导出管线的纯函数测试（zip / transcript / batch）。
 * 与仓库其余 spec 同一纪律：零 mock——所有被测函数均以注入依赖
 * （fake sessionQuery）或纯字节输入工作；ZIP 为 STORE 方式（不压缩），
 * 条目名与内容以明文出现在字节流中，可用 latin1 解码直接断言。
 */
import { describe, expect, it } from 'vitest'
import {
  buildBatchZip,
  enrichSessionTitles,
  MAX_BATCH_SESSIONS,
  normalizeSessionHeaders,
  parseSessionIds,
  toSafeHttpError,
} from '../src/host/batch.ts'
import { HttpError } from '../src/host/http.ts'
import {
  extractContentText,
  titleFromLog,
  transcriptFromLog,
  transcriptToMarkdown,
} from '../src/host/transcript.ts'
import type { SessionLogSnapshot, SessionQueryEngine } from '../src/host/types.ts'
import { buildZip, sanitizeFileName } from '../src/host/zip.ts'

/** 构造日志快照：events 按 seq 递增，data 形状模拟真实日志。 */
function snapshot(
  id: string,
  title: string,
  events: ReadonlyArray<{ type: string; data?: unknown }>,
): SessionLogSnapshot {
  const base = 1_700_000_000_000
  return {
    session: { id, title, createdAt: base },
    events: events.map((event, index) => ({
      type: event.type,
      seq: index + 1,
      time: base + index * 1000,
      data: event.data,
    })),
  }
}

/** fake 会话查询引擎：failIds 模拟单会话读取失败。 */
function fakeQuery(
  snapshots: Record<string, SessionLogSnapshot>,
  failIds: ReadonlySet<string> = new Set(),
): SessionQueryEngine {
  return {
    listSessions: async () => Object.values(snapshots).map((snap) => snap.session),
    readSession: async (id: string) => {
      if (failIds.has(id)) throw new Error('read failed')
      const snap = snapshots[id]
      if (snap === undefined) throw new Error('missing session')
      return snap
    },
  }
}

/** latin1 解码（STORE 方式 ZIP 的明文断言用）。 */
function latin1(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes)
}

/** 最小 STORE-ZIP 读取器（EOCD → 中心目录 → 局部头偏移 → 明文条目）。 */
class ZipReader {
  private readonly bytes: Uint8Array
  private readonly entries = new Map<string, { offset: number; size: number }>()

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    // 定位 EOCD（固定 22 字节，从尾部倒找签名 0x06054b50）。
    let eocd = -1
    for (let i = bytes.byteLength - 22; i >= 0; i -= 1) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
    }
    if (eocd < 0) throw new Error('EOCD not found')
    const count = view.getUint16(eocd + 10, true)
    const centralSize = view.getUint32(eocd + 12, true)
    const centralOffset = view.getUint32(eocd + 16, true)
    let p = centralOffset
    const end = centralOffset + centralSize
    for (let n = 0; n < count; n += 1) {
      if (view.getUint32(p, true) !== 0x02014b50) throw new Error(`bad central header at ${p}`)
      const nameLen = view.getUint16(p + 28, true)
      const extraLen = view.getUint16(p + 30, true)
      const commentLen = view.getUint16(p + 32, true)
      const size = view.getUint32(p + 24, true)
      const offset = view.getUint32(p + 42, true)
      const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen))
      this.entries.set(name, { offset, size })
      p += 46 + nameLen + extraLen + commentLen
    }
    if (p !== end) throw new Error('central directory size mismatch')
  }

  entryNames(): string[] {
    return [...this.entries.keys()]
  }

  read(name: string): Uint8Array {
    const entry = this.entries.get(name)
    if (entry === undefined) throw new Error(`no entry: ${name}`)
    // 局部头 30 字节 + 文件名 + extra；数据紧随其后（STORE 无压缩）。
    const view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength)
    const nameLen = view.getUint16(entry.offset + 26, true)
    const extraLen = view.getUint16(entry.offset + 28, true)
    const start = entry.offset + 30 + nameLen + extraLen
    return this.bytes.subarray(start, start + entry.size)
  }
}

describe('sanitizeFileName', () => {
  it('replaces path-hostile characters with underscores', () => {
    expect(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j')
  })

  it('neutralizes leading dots and caps length at 120', () => {
    // 前导点整段折叠为单个下划线（/^\.+/ → '_'）。
    expect(sanitizeFileName('..hidden')).toBe('_hidden')
    expect(sanitizeFileName('x'.repeat(200)).length).toBe(120)
  })

  it('falls back to untitled when nothing remains', () => {
    expect(sanitizeFileName('.')).toBe('_')
  })
})

describe('buildZip (STORE)', () => {
  it('emits valid local header + EOCD with the entry count', () => {
    const bytes = buildZip([
      { name: 'alpha.md', data: new TextEncoder().encode('# alpha\n') },
      { name: 'beta.md', data: new TextEncoder().encode('# beta\n') },
    ])
    // 局部文件头签名 PK\x03\x04。
    expect(latin1(bytes.slice(0, 4))).toBe('PK\u0003\u0004')
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const eocd = bytes.byteLength - 22
    expect(view.getUint32(eocd, true)).toBe(0x06054b50)
    expect(view.getUint16(eocd + 10, true)).toBe(2)
  })

  it('stores entry names and content verbatim (no compression)', () => {
    const bytes = buildZip([{ name: 'alpha.md', data: new TextEncoder().encode('# alpha body\n') }])
    const text = latin1(bytes)
    expect(text).toContain('alpha.md')
    expect(text).toContain('# alpha body')
  })
})

describe('extractContentText', () => {
  it('passes strings through and flattens content blocks', () => {
    expect(extractContentText('hello')).toBe('hello')
    expect(extractContentText([
      { type: 'text', text: 'part one' },
      { type: 'tool_use', name: 'grep' },
      { type: 'tool_result' },
      { type: 'text', text: 'part two' },
    ])).toBe('part one\n[工具调用：grep]\n[工具结果]\npart two')
  })

  it('returns empty for non-content shapes', () => {
    expect(extractContentText(undefined)).toBe('')
    expect(extractContentText(42)).toBe('')
    expect(extractContentText([{ type: 'image' }])).toBe('')
  })
})

describe('transcriptFromLog', () => {
  it('extracts user/assistant turns in seq order and skips empty/other events', () => {
    const snap = snapshot('s1', 'alpha', [
      { type: 'user/message', data: { content: 'question' } },
      { type: 'session/renamed', data: { title: 'x' } },
      { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'answer' }] } } },
      { type: 'user/message', data: { content: '' } },
    ])
    const turns = transcriptFromLog(snap)
    expect(turns.map((turn) => turn.role)).toEqual(['user', 'assistant'])
    expect(turns[0]?.text).toBe('question')
    expect(turns[1]?.text).toBe('answer')
  })

  it('sorts defensively by seq when events arrive out of order', () => {
    const base = 1_700_000_000_000
    const snap: SessionLogSnapshot = {
      session: { id: 's1', title: 't', createdAt: base },
      events: [
        { type: 'assistant/message', seq: 2, time: base + 2, data: { content: 'answer' } },
        { type: 'user/message', seq: 1, time: base + 1, data: { content: 'question' } },
      ],
    }
    expect(transcriptFromLog(snap).map((turn) => turn.text)).toEqual(['question', 'answer'])
  })
})

describe('transcriptToMarkdown', () => {
  it('renders a metadata header plus turn sections', () => {
    const snap = snapshot('s1', 'alpha', [
      { type: 'user/message', data: { content: 'question' } },
      { type: 'assistant/message', data: { content: 'answer' } },
    ])
    const md = transcriptToMarkdown(snap.session, transcriptFromLog(snap), { timestamps: true })
    expect(md).toContain('# alpha')
    expect(md).toContain('会话 ID：s1')
    expect(md).toContain('### 用户')
    expect(md).toContain('### 助手')
    expect(md).toContain('question')
    expect(md).toContain('answer')
  })
})

describe('parseSessionIds', () => {
  it('accepts and trims a non-empty string array', () => {
    expect(parseSessionIds({ sessionIds: [' a ', 'b'] })).toEqual(['a', 'b'])
  })

  it('rejects missing, empty, or malformed payloads', () => {
    expect(() => parseSessionIds({})).toThrow(HttpError)
    expect(() => parseSessionIds({ sessionIds: [] })).toThrow(HttpError)
    expect(() => parseSessionIds({ sessionIds: ['a', 1] })).toThrow(HttpError)
    expect(() => parseSessionIds('nope')).toThrow(HttpError)
  })
})

describe('buildBatchZip', () => {
  const alpha = snapshot('s1', 'alpha', [
    { type: 'user/message', data: { content: 'question one' } },
  ])
  const beta = snapshot('s2', 'beta', [
    { type: 'user/message', data: { content: 'question two' } },
  ])

  it('packs each readable session as a Markdown entry and counts skips', async () => {
    const query = fakeQuery(
      { s1: alpha, s2: beta, s3: alpha },
      new Set(['s3']),
    )
    const result = await buildBatchZip(query, ['s1', 's2', 's3'])
    expect(result.skipped).toBe(1)
    expect(result.fileName).toMatch(/^dsh-conversations-\d{4}-\d{2}-\d{2}\.zip$/)
    const text = latin1(result.bytes)
    expect(text).toContain('alpha.md')
    expect(text).toContain('beta.md')
    expect(text).toContain('# alpha')
    expect(text).toContain('# beta')
    // EOCD 条目数 = 2 会话 + index.html + manifest.json。
    const view = new DataView(result.bytes.buffer, result.bytes.byteOffset, result.bytes.byteLength)
    expect(view.getUint16(result.bytes.byteLength - 22 + 10, true)).toBe(4)
  })

  it('deduplicates repeated session ids', async () => {
    const query = fakeQuery({ s1: alpha })
    const result = await buildBatchZip(query, ['s1', 's1', 's1'])
    expect(result.skipped).toBe(0)
    const view = new DataView(result.bytes.buffer, result.bytes.byteOffset, result.bytes.byteLength)
    // 1 会话 + index.html + manifest.json。
    expect(view.getUint16(result.bytes.byteLength - 22 + 10, true)).toBe(3)
  })

  it('suffixes duplicate entry names with -2/-3', async () => {
    const twin = snapshot('s2', 'alpha', [
      { type: 'user/message', data: { content: 'twin body' } },
    ])
    const query = fakeQuery({ s1: alpha, s2: twin })
    const text = latin1((await buildBatchZip(query, ['s1', 's2'])).bytes)
    expect(text).toContain('alpha.md')
    expect(text).toContain('alpha-2.md')
  })

  it('rejects more than MAX_BATCH_SESSIONS unique ids', async () => {
    const query = fakeQuery({})
    const ids = Array.from({ length: MAX_BATCH_SESSIONS + 1 }, (_, i) => `s${i}`)
    await expect(buildBatchZip(query, ids)).rejects.toMatchObject({ status: 400 })
  })

  it('throws 404 when no session is readable', async () => {
    const query = fakeQuery({ s1: alpha }, new Set(['s1']))
    await expect(buildBatchZip(query, ['s1'])).rejects.toMatchObject({ status: 404 })
  })

  it('keeps input order under concurrent reads that complete out of order', async () => {
    // 反向延迟：越靠前的会话越晚 resolve，验证输出顺序由槽位而非完成顺序决定。
    const ids = ['s1', 's2', 's3', 's4', 's5']
    const snaps = Object.fromEntries(ids.map((id, i) => [id, snapshot(id, `t${i + 1}`, [])]))
    const query: SessionQueryEngine = {
      listSessions: async () => [],
      readSession: async (id: string) => {
        const delay = (ids.length - ids.indexOf(id)) * 5
        await new Promise((r) => setTimeout(r, delay))
        return snaps[id]!
      },
    }
    const result = await buildBatchZip(query, ids)
    const text = latin1(result.bytes)
    const positions = ['t1.md', 't2.md', 't3.md', 't4.md', 't5.md'].map((n) => text.indexOf(n))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(result.skipped).toBe(0)
  })

  it('counts skipped correctly when reads fail interleaved with concurrent workers', async () => {
    const ids = ['ok1', 'bad1', 'ok2', 'bad2', 'ok3', 'bad3', 'ok4', 'bad4']
    const snaps = Object.fromEntries(
      ids.filter((id) => id.startsWith('ok')).map((id) => [id, snapshot(id, id, [])]),
    )
    const query: SessionQueryEngine = {
      listSessions: async () => [],
      readSession: async (id: string) => {
        await new Promise((r) => setTimeout(r, Math.random() * 10))
        if (id.startsWith('bad')) throw new Error('read failed')
        return snaps[id]!
      },
    }
    const result = await buildBatchZip(query, ids)
    expect(result.skipped).toBe(4)
    // 精确断言：4 个会话条目 + 档案层 2 个（.md 字符串会出现在阅读器
    // JS 与 manifest 内容里，不能按全局子串计数）。
    const zip = new ZipReader(result.bytes)
    expect(zip.entryNames().filter((n) => n.endsWith('.md'))).toHaveLength(4)
    expect(zip.entryNames()).toContain('index.html')
    expect(zip.entryNames()).toContain('manifest.json')
  })

  it('bundles the portable archive (index.html + manifest.json) with every export', async () => {
    const query: SessionQueryEngine = {
      listSessions: async () => [],
      readSession: async (id: string) => snapshot(id, `${id}-title`, []),
    }
    const result = await buildBatchZip(query, ['s1', 's2'])
    const zip = new ZipReader(result.bytes)
    const names = zip.entryNames()
    // 2 个会话条目 + manifest.json + index.html。
    expect(names.filter((n) => n.endsWith('.md'))).toEqual(['s1-title.md', 's2-title.md'])
    expect(names).toContain('manifest.json')
    expect(names).toContain('index.html')

    const manifest = JSON.parse(new TextDecoder().decode(zip.read('manifest.json')))
    expect(manifest.kind).toBe('dsh-conv-export-archive')
    expect(manifest.version).toBe(2)
    expect(manifest.stats).toEqual({
      sessions: 2,
      turns: 0,
      firstAt: 1_700_000_000_000,
      lastAt: 1_700_000_000_000,
    })
    expect(manifest.sessions).toEqual([
      { id: 's1', title: 's1-title', createdAt: 1_700_000_000_000, turns: 0, preview: '', file: 's1-title.md' },
      { id: 's2', title: 's2-title', createdAt: 1_700_000_000_000, turns: 0, preview: '', file: 's2-title.md' },
    ])

    const viewer = new TextDecoder().decode(zip.read('index.html'))
    expect(viewer).toContain('<!DOCTYPE html>')
    expect(viewer).toContain('s1-title')
  })

  it('derives the smart-archive preview from the first user turn', async () => {
    const query: SessionQueryEngine = {
      listSessions: async () => [],
      readSession: async (id: string) =>
        snapshot(id, `${id}-title`, [
          { type: 'user/message', data: { content: `  ${id} 的\n\n首个问题   ` } },
          { type: 'assistant/message', data: { content: '回答' } },
        ]),
    }
    const result = await buildBatchZip(query, ['s1'])
    const zip = new ZipReader(result.bytes)
    const manifest = JSON.parse(new TextDecoder().decode(zip.read('manifest.json')))
    // 摘要压缩空白；仅首条用户消息进入 preview。
    expect(manifest.sessions[0]).toMatchObject({ id: 's1', turns: 2, preview: 's1 的 首个问题' })
    expect(manifest.stats).toEqual({ sessions: 1, turns: 2, firstAt: 1_700_000_000_000, lastAt: 1_700_000_000_000 })
    // 阅读器 payload 同样携带摘要（时间线侧栏不点开即知主题）。
    const viewer = new TextDecoder().decode(zip.read('index.html'))
    expect(viewer).toContain('s1 的 首个问题')
  })
})

describe('toSafeHttpError', () => {
  it('passes HttpError through and wraps everything else as 500', () => {
    const http = new HttpError('bad input', 400)
    expect(toSafeHttpError(http, 'fallback')).toBe(http)
    const wrapped = toSafeHttpError(new Error('internal detail'), 'fallback')
    expect(wrapped.status).toBe(500)
    expect(wrapped.message).toBe('fallback')
  })
})

describe('normalizeSessionHeaders', () => {
  it('unwraps nested corpus records from the real harness', () => {
    const records = [
      { header: { version: 0, id: 's1', createdAt: 123, cwd: '/p', delegationDepth: 0 }, live: false, persisted: true },
      { header: { version: 0, id: 's2', createdAt: 456, cwd: '/q', delegationDepth: 0 }, live: true, persisted: false },
    ] as const
    const headers = normalizeSessionHeaders(records as never)
    expect(headers).toEqual([
      { id: 's1', createdAt: 123 },
      { id: 's2', createdAt: 456 },
    ])
  })

  it('keeps flat headers (dev stubs / legacy adapters) as-is', () => {
    const headers = normalizeSessionHeaders([
      { id: 's1', title: '对话', createdAt: 1, updatedAt: 2 },
    ])
    expect(headers).toEqual([{ id: 's1', title: '对话', createdAt: 1, updatedAt: 2 }])
  })

  it('silently skips malformed records', () => {
    const headers = normalizeSessionHeaders([
      { header: { id: 'ok', createdAt: 1 } },
      { nope: true },
      null,
    ] as never)
    expect(headers).toEqual([{ id: 'ok', createdAt: 1 }])
  })
})

describe('enrichSessionTitles', () => {
  it('fills titles from readTitleSnapshots in input order', async () => {
    const sessions = normalizeSessionHeaders([
      { header: { id: 's1', createdAt: 1 } },
      { header: { id: 's2', createdAt: 2 } },
    ] as never)
    const query: SessionQueryEngine = {
      listSessions: async () => [],
      readSession: async () => { throw new Error('unused') },
      readTitleSnapshots: async (ids: readonly string[]) =>
        ids.map((id, i) =>
          id === 's2'
            ? { status: 'rejected', reason: new Error('missing') }
            : { status: 'fulfilled', value: { title: { title: `标题${i + 1}`, updatedAt: 99 } } },
        ),
    }
    await enrichSessionTitles(query, sessions)
    expect(sessions[0]).toEqual({ id: 's1', createdAt: 1, title: '标题1', updatedAt: 99 })
    expect(sessions[1]).toEqual({ id: 's2', createdAt: 2 })
  })

  it('is a no-op without the optional service or on failure', async () => {
    const sessions = [{ id: 's1', createdAt: 1 }]
    await enrichSessionTitles({ listSessions: async () => [], readSession: async () => { throw new Error() } }, sessions)
    expect(sessions[0]).toEqual({ id: 's1', createdAt: 1 })
    const failing: SessionQueryEngine = {
      listSessions: async () => [],
      readSession: async () => { throw new Error() },
      readTitleSnapshots: async () => { throw new Error('boom') },
    }
    await enrichSessionTitles(failing, sessions)
    expect(sessions[0]).toEqual({ id: 's1', createdAt: 1 })
  })
})

describe('titleFromLog', () => {
  it('folds the latest session/title event', () => {
    const events = [
      { type: 'session/title', seq: 1, time: 1, data: { title: '旧标题', messageSeqs: [], source: { kind: 'user' } } },
      { type: 'user/message', seq: 2, time: 2, data: { content: [{ type: 'text', text: 'hi' }] } },
      { type: 'session/title', seq: 3, time: 3, data: { title: '新标题', messageSeqs: [], source: { kind: 'user' } } },
    ]
    expect(titleFromLog(events)).toBe('新标题')
  })

  it('returns empty string without title events', () => {
    expect(titleFromLog([{ type: 'user/message', seq: 1, time: 1, data: {} }])).toBe('')
  })

  it('feeds batch export entry names from the log when the header has no title', async () => {
    // 真实宿主形状：头无标题，标题在 session/title 事件里。
    // 条目名断言用 ASCII（latin1 解码不覆盖 UTF-8 多字节序列）。
    const snap: SessionLogSnapshot = {
      session: { id: 's1', createdAt: 1_700_000_000_000 },
      events: [
        { type: 'session/title', seq: 1, time: 1_700_000_000_000, data: { title: 'log-title', messageSeqs: [], source: { kind: 'user' } } },
        { type: 'user/message', seq: 2, time: 1_700_000_000_000, data: { content: [{ type: 'text', text: '你好' }] } },
      ],
    }
    const query: SessionQueryEngine = {
      listSessions: async () => [],
      readSession: async () => snap,
    }
    const result = await buildBatchZip(query, ['s1'])
    expect(latin1(result.bytes)).toContain('log-title.md')
    const text = new TextDecoder().decode(result.bytes)
    expect(text).toContain('# log-title')
  })
})
