import { beforeEach, describe, expect, it } from 'vitest'
import { extractTurn } from '../src/client/extract.ts'

/** Reset the document between cases — extractTurn resolves the pane globally. */
beforeEach(() => {
  document.body.innerHTML = ''
})

/** Build a conversation scrollport holding `html`. */
function makePane(html: string): HTMLElement {
  const port = document.createElement('div')
  port.setAttribute('data-conversation-scroll', '')
  port.innerHTML = html
  document.body.appendChild(port)
  return port
}

describe('extractTurn', () => {
  it('extracts the turn inside its chat-node seat and reports its ordinal', () => {
    makePane(`
      <div data-chat-anchor-key="k1">
        <div class="_markdown_9zz_1"><p>第一轮回答</p></div>
        <div class="strip"><button class="dsh-conv-export-turn" id="b1"></button></div>
      </div>
      <div data-chat-anchor-key="k2">
        <div class="_markdown_9zz_1"><p>第二轮回答</p></div>
        <div class="strip"></div>
      </div>
    `)
    const turn = extractTurn(document.querySelector('#b1') as Element)
    expect(turn).not.toBeNull()
    expect(turn?.messages).toHaveLength(1)
    expect(turn?.messages[0]).toMatchObject({ role: 'assistant', text: '第一轮回答' })
    expect(turn?.index).toBe(1)
  })

  it('returns every segment rendered inside the seat (user question + reply)', () => {
    makePane(`
      <div data-chat-anchor-key="k1">
        <div class="gdEzaW_userRow"><div class="gdEzaW_bubble">这个问题</div></div>
        <div class="_markdown_9zz_1"><p>这个回答</p></div>
        <div class="strip"><button class="dsh-conv-export-turn" id="b2"></button></div>
      </div>
    `)
    const turn = extractTurn(document.querySelector('#b2') as Element)
    expect(turn?.messages.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(turn?.messages[0]?.text).toBe('这个问题')
    expect(turn?.index).toBe(1)
  })

  it('falls back to the markdown container closest to the button', () => {
    // Seats gone (renamed attribute) — the strip still hangs off the row that
    // owns its reply, so the deepest shared ancestor picks the right body.
    makePane(`
      <div class="row"><div class="_markdown_9zz_1"><p>靠前的回答</p></div>
        <div class="strip"><button class="dsh-conv-export-turn" id="b3"></button></div></div>
      <div class="row"><div class="_markdown_9zz_1"><p>靠后的回答</p></div>
        <div class="strip"></div></div>
    `)
    const turn = extractTurn(document.querySelector('#b3') as Element)
    expect(turn?.messages).toHaveLength(1)
    expect(turn?.messages[0]?.text).toBe('靠前的回答')
    expect(turn?.index).toBe(1)
  })

  it('numbers the fallback by position among outermost bodies', () => {
    makePane(`
      <div class="row"><div class="_markdown_9zz_1"><p>第一</p></div><div class="strip"></div></div>
      <div class="row"><div class="_markdown_9zz_1"><p>第二</p></div>
        <div class="strip"><button class="dsh-conv-export-turn" id="b4"></button></div></div>
    `)
    const turn = extractTurn(document.querySelector('#b4') as Element)
    expect(turn?.messages[0]?.text).toBe('第二')
    expect(turn?.index).toBe(2)
  })

  it('returns null when the pane renders no assistant body', () => {
    makePane(`<div class="strip"><button class="dsh-conv-export-turn" id="b5"></button></div>`)
    expect(extractTurn(document.querySelector('#b5') as Element)).toBeNull()
  })

  it('returns null when there is no conversation pane', () => {
    expect(extractTurn(document.createElement('button'))).toBeNull()
  })

  it('maps strips to bodies by ordinal when strips share one container', () => {
    // 回归：动作条与正文不交错（同排按钮集中在一条容器里）时，「取按钮之前
    // 最近的正文」对每个按钮都命中同一条 → 永远导出第一段。等量按下标映射。
    makePane(`
      <div data-chat-anchor-key="group:all">
        <div class="_markdown_9zz_1"><p>第一段</p></div>
        <div class="gdEzaW_userRow"><div class="gdEzaW_bubble">第二个问题</div></div>
        <div class="_markdown_9zz_1"><p>第二段</p></div>
        <div class="strip"><button class="dsh-conv-export-turn" id="bA"></button><button class="dsh-conv-export-turn" id="bB"></button></div>
      </div>
    `)
    const a = extractTurn(document.querySelector('#bA') as Element)
    const b = extractTurn(document.querySelector('#bB') as Element)
    expect(a?.messages[a.messages.length - 1]?.text).toBe('第一段')
    expect(a?.index).toBe(1)
    expect(b?.messages[b.messages.length - 1]?.text).toBe('第二段')
    expect(b?.index).toBe(2)
    expect(b?.messages[0]).toMatchObject({ role: 'user', text: '第二个问题' })
  })

  it('pins the reply through the slot-provided messageId seat', () => {
    makePane(`
      <div data-chat-anchor-key="assistant/msg-1"><div class="_markdown_9zz_1"><p>甲</p></div></div>
      <div data-chat-anchor-key="assistant/msg-2"><div class="_markdown_9zz_1"><p>乙</p></div></div>
      <div class="strip"><button class="dsh-conv-export-turn" id="bC"></button></div>
    `)
    const el = document.querySelector('#bC') as Element
    const second = extractTurn(el, 'msg-2')
    expect(second?.messages[second.messages.length - 1]?.text).toBe('乙')
    expect(second?.index).toBe(2)
    const first = extractTurn(el, 'msg-1')
    expect(first?.messages[first.messages.length - 1]?.text).toBe('甲')
    expect(first?.index).toBe(1)
  })
})
