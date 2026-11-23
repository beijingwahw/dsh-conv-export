import { describe, expect, it } from 'vitest'
import {
  archivePreview,
  buildArchiveManifest,
  buildArchiveStats,
  buildArchiveViewerHtml,
  type ArchiveSessionData,
} from '../src/host/archive.ts'

const sessions: ArchiveSessionData[] = [
  {
    id: 's1',
    title: '分片光栅化讨论',
    createdAt: 1_700_000_000_000,
    turnCount: 2,
    preview: '长图导出怎么做？',
    markdown: '# 分片光栅化讨论\n\n### 用户（2023-11-14 22:13）\n\n长图导出怎么做？\n\n### 助手（2023-11-14 22:14）\n\n分片光栅化…',
  },
  {
    id: 's2',
    title: 'ZIP 规范',
    createdAt: 1_700_000_100_000,
    updatedAt: 1_700_000_200_000,
    turnCount: 1,
    preview: 'CRC32 是什么？',
    markdown: '# ZIP 规范\n\n### 用户（2023-11-14 22:15）\n\nCRC32 是什么？',
  },
]

describe('archivePreview', () => {
  it('collapses whitespace and truncates to 96 chars', () => {
    expect(archivePreview('  多行\n\n文本   保留 词间  ')).toBe('多行 文本 保留 词间')
    const long = 'a'.repeat(200)
    const preview = archivePreview(long)
    expect(preview).toHaveLength(97)
    expect(preview.endsWith('…')).toBe(true)
    expect(preview.slice(0, 96)).toBe('a'.repeat(96))
  })

  it('returns empty string for blank input', () => {
    expect(archivePreview('')).toBe('')
    expect(archivePreview('   \n\t  ')).toBe('')
  })
})

describe('buildArchiveStats', () => {
  it('aggregates sessions, turns, and time span', () => {
    const stats = buildArchiveStats([
      { id: 's1', title: 'a', createdAt: 200, turns: 3, file: 'a.md' },
      { id: 's2', title: 'b', createdAt: 100, turns: 4, file: 'b.md' },
      { id: 's3', title: 'c', createdAt: 300, turns: 5, file: 'c.md' },
    ])
    expect(stats).toEqual({ sessions: 3, turns: 12, firstAt: 100, lastAt: 300 })
  })

  it('returns zero values for an empty archive', () => {
    expect(buildArchiveStats([])).toEqual({ sessions: 0, turns: 0 })
  })
})

describe('buildArchiveManifest', () => {
  it('produces a machine-readable v2 index with stats and per-session previews', () => {
    const json = buildArchiveManifest(
      [
        { id: 's1', title: '分片光栅化讨论', createdAt: 1, turns: 2, preview: '长图导出怎么做？', file: '分片光栅化讨论.md' },
        { id: 's2', title: 'ZIP 规范', createdAt: 2, updatedAt: 3, turns: 1, preview: 'CRC32 是什么？', file: 'ZIP 规范.md' },
      ],
      { exportedAt: 1_700_000_000_000 },
    )
    const parsed = JSON.parse(json)
    expect(parsed.kind).toBe('dsh-conv-export-archive')
    expect(parsed.version).toBe(2)
    expect(parsed.exportedAt).toBe(1_700_000_000_000)
    expect(parsed.stats).toEqual({ sessions: 2, turns: 3, firstAt: 1, lastAt: 2 })
    expect(parsed.sessions).toEqual([
      { id: 's1', title: '分片光栅化讨论', createdAt: 1, turns: 2, preview: '长图导出怎么做？', file: '分片光栅化讨论.md' },
      { id: 's2', title: 'ZIP 规范', createdAt: 2, updatedAt: 3, turns: 1, preview: 'CRC32 是什么？', file: 'ZIP 规范.md' },
    ])
  })
})

describe('buildArchiveViewerHtml', () => {
  const html = buildArchiveViewerHtml(sessions, { exportedAt: 1_700_000_000_000 })

  it('is a self-contained HTML document with embedded session data', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('<script id="dsh-archive" type="application/json">')
    expect(html).toContain('</html>')
    // 无外部资源引用：离线 / file:// 可用（无 src=、href= 外链）。
    expect(html).not.toMatch(/(src|href)\s*=\s*["']https?:/)
  })

  it('embeds a valid JSON payload with all sessions and markdown sources', () => {
    const m = /<script id="dsh-archive" type="application\/json">([\s\S]*?)<\/script>/.exec(html)
    expect(m).not.toBeNull()
    const parsed = JSON.parse(m![1]!)
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toMatchObject({ id: 's1', title: '分片光栅化讨论', turnCount: 2 })
    expect(parsed[1]!.markdown).toContain('CRC32')
  })

  it('neutralizes </script> sequences inside embedded data', () => {
    const evil: ArchiveSessionData[] = [
      { id: 'x', title: '</script><script>alert(1)</script>', createdAt: 0, turnCount: 0, preview: '', markdown: '</script>' },
    ]
    const evilHtml = buildArchiveViewerHtml(evil, { exportedAt: 0 })
    // 嵌入串内不允许出现裸的 </script>（会被解析为标签提前闭合）。
    const payload = /<script id="dsh-archive" type="application\/json">([\s\S]*?)<\/script>/.exec(evilHtml)![1]!
    expect(payload).not.toContain('</script>')
    expect(JSON.parse(payload)[0]!.title).toContain('</script>')
  })

  it('renders interactive controls (search, copy, download, raw view)', () => {
    expect(html).toContain('id="q"')
    expect(html).toContain('id="copy"')
    expect(html).toContain('id="save"')
    expect(html).toContain('id="toggle"')
    // 全文搜索数据源：title + markdown 均已嵌入。
    expect(html).toContain('长图导出怎么做？')
  })

  it('ships the smart-archive layer: timeline grouping, stats bar, previews', () => {
    // 时间线分组：组头样式与 dayKey 分组逻辑均已内联。
    expect(html).toContain('.grp')
    expect(html).toContain('function dayKey')
    // 统计条：现场折取会话数 / 总轮次 / 时间跨度。
    expect(html).toContain('totalTurns')
    expect(html).toContain('个会话')
    // 摘要预览：payload 携带 preview 字段并渲染 .p 行。
    expect(html).toContain('"preview"')
    expect(html).toContain("s.preview")
  })
})
