import { describe, expect, it } from 'vitest'
import { extractMessages, readTitle, safeFileStem } from '../src/client/extract.ts'

function makeScope(html: string): HTMLElement {
  const port = document.createElement('div')
  port.setAttribute('data-conversation-scroll', '')
  port.innerHTML = html
  document.body.appendChild(port)
  return port
}

describe('extractMessages', () => {
  it('returns turns in document order with roles', () => {
    const port = makeScope(`
      <div class="gdEzaW_userRow"><div class="gdEzaW_userStack">
        <div class="gdEzaW_bubble"><div class="_text_1pfhk_1">你好</div></div>
      </div></div>
      <div class="Sxvs8a_root"><div class="Sxvs8a_body">
        <div class="_markdown_1nba0_5"><h1>导出测试回复</h1><p>正文</p></div>
      </div></div>
      <div class="gdEzaW_userRow"><div class="gdEzaW_bubble">第二条</div></div>
    `)
    const msgs = extractMessages(port)
    expect(msgs).toHaveLength(3)
    expect(msgs[0]).toMatchObject({ role: 'user', text: '你好' })
    expect(msgs[1]?.role).toBe('assistant')
    expect(msgs[1]?.html).toContain('导出测试回复')
    expect(msgs[2]).toMatchObject({ role: 'user', text: '第二条' })
    port.remove()
  })

  it('skips empty shells (still-streaming assistants)', () => {
    const port = makeScope(`
      <div class="gdEzaW_userRow"><div class="gdEzaW_bubble">q</div></div>
      <div class="_markdown_x"><p>   </p></div>
    `)
    const msgs = extractMessages(port)
    expect(msgs).toHaveLength(1)
    expect(msgs[0]?.role).toBe('user')
    port.remove()
  })

  it('returns [] when scope is null', () => {
    expect(extractMessages(null)).toEqual([])
  })
})

describe('readTitle', () => {
  it('reads the breadcrumb title', () => {
    const el = document.createElement('span')
    el.className = 'wSkVaW_crumbSeg'
    el.textContent = '我的会话'
    document.body.appendChild(el)
    expect(readTitle()).toBe('我的会话')
    el.remove()
  })

  it('returns null when absent', () => {
    expect(readTitle()).toBeNull()
  })
})

describe('safeFileStem', () => {
  it('collapses hostile characters and whitespace', () => {
    expect(safeFileStem('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j')
    expect(safeFileStem('  hello   world  ')).toBe('hello-world')
  })
  it('falls back for empty input', () => {
    expect(safeFileStem('///')).toBe('conversation')
  })
  it('caps at 60 chars', () => {
    expect(safeFileStem('x'.repeat(100))).toHaveLength(60)
  })
})
