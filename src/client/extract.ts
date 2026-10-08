/**
 * Conversation extraction: walks the rendered transcript and produces a
 * role-ordered message list the exporters (Markdown / PDF / long image)
 * share.
 *
 * Selectors come from the stock web app's rendered DOM (verified against a
 * live session): user turns hang under a row whose CSS-module class ends in
 * `_userRow` (bubble text inside `[class*="_bubble"]`); assistant turns are
 * rendered markdown under `[class*="_markdown_"]`. Class names are
 * hash-prefixed (`gdEzaW_userRow`), so attribute-contains matching is the
 * stable contract.
 *
 * No cordis, no React — pure DOM helpers, unit-testable against jsdom.
 */

/** Selector of the conversation scrollport the extractor operates within. */
export const SCROLL_SELECTOR = '[data-conversation-scroll]'
/** Selector matching a user turn row. */
export const USER_ROW_SELECTOR = '[class*="_userRow"]'
/** Selector matching the user bubble inside the row. */
export const USER_BUBBLE_SELECTOR = '[class*="_bubble"]'
/** Selector matching an assistant turn's rendered markdown container. */
export const ASSISTANT_MD_SELECTOR = '[class*="_markdown_"]'
/** Selector of the header breadcrumb segment carrying the session title. */
export const TITLE_SELECTOR = '[class*="crumbSeg"]'

/** One extracted turn of the conversation. */
export interface ExtractedMessage {
  /** Who produced the turn. */
  readonly role: 'user' | 'assistant'
  /** Plain text (user turns) — the bubble's visible text. */
  readonly text: string
  /** Rendered HTML (assistant turns) — the markdown container's innerHTML. */
  readonly html: string
}

/**
 * Resolve the conversation scrollport from anywhere in the document.
 * @param from - any element or the document itself.
 * @returns the scrollport element, or null when no conversation is rendered.
 */
export function resolveScope(from: ParentNode = document): HTMLElement | null {
  return from.querySelector<HTMLElement>(SCROLL_SELECTOR)
}

/**
 * Read the session title from the header breadcrumb.
 * @returns the trimmed title, or null when absent.
 */
export function readTitle(): string | null {
  return document.querySelector(TITLE_SELECTOR)?.textContent?.trim() || null
}

/**
 * Extract every rendered turn in document order. User rows and assistant
 * markdown containers are collected with one combined querySelectorAll,
 * which returns document order — so the interleaving is exactly what the
 * reader sees.
 * @param scope - the conversation scrollport (defaults to resolving one).
 * @returns the ordered turns; empty when nothing is rendered.
 */
export function extractMessages(scope?: HTMLElement | null): ExtractedMessage[] {
  const port = scope ?? resolveScope()
  if (port === null) return []
  const nodes = port.querySelectorAll<HTMLElement>(`${USER_ROW_SELECTOR}, ${ASSISTANT_MD_SELECTOR}`)
  const out: ExtractedMessage[] = []
  for (const node of nodes) {
    if (node.matches(USER_ROW_SELECTOR)) {
      const message = fromUserRow(node)
      if (message !== null) out.push(message)
    } else {
      const message = fromMarkdownNode(node)
      if (message !== null) out.push(message)
    }
  }
  return out
}

/**
 * Build one user turn from its row node (bubble text, falling back to the
 * whole row when the bubble class is absent).
 * @param node - the `_userRow` element.
 * @returns the turn, or null when the row renders no text (empty shell).
 */
export function fromUserRow(node: HTMLElement): ExtractedMessage | null {
  const bubble = node.querySelector(USER_BUBBLE_SELECTOR) ?? node
  const text = (bubble.textContent ?? '').trim()
  if (text === '') return null
  return { role: 'user', text, html: '' }
}

/**
 * Build one assistant turn from its markdown container (skip empty shells —
 * still-streaming placeholders render no text yet).
 * @param node - the `_markdown_` element.
 * @returns the turn, or null when the container renders no text.
 */
export function fromMarkdownNode(node: HTMLElement): ExtractedMessage | null {
  const text = (node.textContent ?? '').trim()
  if (text === '') return null
  return { role: 'assistant', text, html: node.innerHTML }
}

/** Class shared by every per-turn export button (strip entry + CSS hooks). */
export const TURN_BUTTON_CLASS = 'dsh-conv-export-turn'

/** Selector matching this plugin's own per-turn buttons inside a pane. */
const TURN_BUTTON_SELECTOR = `.${TURN_BUTTON_CLASS}`

/** Per-turn extraction result (the assistant-actions strip's export entry). */
export interface TurnExtract {
  /** The turn's segment (user question when adjacent + the reply), document order. */
  readonly messages: readonly ExtractedMessage[]
  /** 1-based ordinal among every assistant markdown container in the pane; 0 = unknown. */
  readonly index: number
}

/**
 * Extract the single turn that owns `anchor` — the per-turn export button
 * rendered into `conversation.chat.assistant-actions`.
 *
 * The strip does NOT reliably sit inside the reply's own wrapper, so ancestry
 * is only a hint; resolution therefore layers three independent probes:
 *
 * 1. **messageId seat** — the slot hands us the assistant message id; the
 *    pane keys its chat-node seats by message key, so a seat containing that
 *    id pins the body exactly.
 * 2. **button ordinal** — the plugin renders one button per finalized reply,
 *    so with `buttons.length === bodies.length` the Nth button maps to the
 *    Nth body. Correct even when every strip shares one container (the layout
 *    that made ancestry return the first reply for every button).
 * 3. **document order** — the body immediately preceding the strip (strips
 *    render under their reply); falls forward when a strip renders above it.
 *
 * The user question directly preceding the chosen body joins the segment, so
 * "this turn" exports ask + answer.
 *
 * @param anchor - the per-turn export button.
 * @param messageId - slot-provided assistant message id (may be undefined).
 * @returns the turn payload, or null when no rendered body is reachable.
 */
export function extractTurn(anchor: Element, messageId?: string): TurnExtract | null {
  const port = resolveScope()
  if (port === null) return null

  const bodies = outermostMarkdown(port)
  if (bodies.length === 0) return null

  let md: HTMLElement | null = messageId === undefined || messageId === ''
    ? null
    : lastMarkdownIn(seatFor(port, messageId))
  if (md === null) md = markdownByButtonOrdinal(port, anchor, bodies)
  if (md === null) md = precedingMarkdown(port, anchor, bodies)
  if (md === null) return null

  const message = fromMarkdownNode(md)
  if (message === null) return null

  const ordered = messageRows(port)
  const messages: ExtractedMessage[] = []
  const at = ordered.indexOf(md)
  if (at > 0) {
    const prev = ordered[at - 1]
    if (prev !== undefined && prev.matches(USER_ROW_SELECTOR)) {
      const user = fromUserRow(prev)
      if (user !== null) messages.push(user)
    }
  }
  messages.push(message)
  return { messages, index: bodies.indexOf(md) + 1 }
}

/**
 * Nearest markdown container *above* `md` (ancestors only — `closest`
 * matches self first, so it cannot answer this). Null when `md` renders no
 * markdown ancestor, i.e. it is an outermost body.
 * @param md - the markdown container.
 * @returns the owning ancestor container, or null.
 */
function outermostOwner(md: HTMLElement): HTMLElement | null {
  return md.parentElement?.closest<HTMLElement>(ASSISTANT_MD_SELECTOR) ?? null
}

/**
 * The seat keyed by a message id — DSH renders `[data-chat-anchor-key]` per
 * chat node with a message-derived key; a substring match pins the exact
 * message even when the key carries a prefix or suffix.
 * @param port - the conversation scrollport.
 * @param messageId - the assistant message id from the slot.
 * @returns the seat element, or null when no seat carries that id.
 */
function seatFor(port: HTMLElement, messageId: string): HTMLElement | null {
  const escaped = messageId.replace(/["\\]/g, '\\$&')
  const exact = port.querySelector<HTMLElement>(`[data-chat-anchor-key="${escaped}"]`)
  if (exact !== null) return exact
  // 子串命中可能撞上更长的 id（"msg-1" ⊂ "msg-10"）：取键最短的那个，
  // 即与精确匹配最接近的座位。
  let best: HTMLElement | null = null
  let bestLength = Number.POSITIVE_INFINITY
  for (const el of port.querySelectorAll<HTMLElement>('[data-chat-anchor-key]')) {
    const key = el.getAttribute('data-chat-anchor-key') ?? ''
    if (!key.includes(messageId)) continue
    if (key.length < bestLength) {
      best = el
      bestLength = key.length
    }
  }
  return best
}

/**
 * The outermost markdown bodies inside `seat` (last one wins — a seat may
 * hold a chain of appends for the same message).
 * @param seat - the seat element, or null.
 * @returns the last body, or null when the seat renders none.
 */
function lastMarkdownIn(seat: HTMLElement | null): HTMLElement | null {
  if (seat === null) return null
  const hits = Array.from(seat.querySelectorAll<HTMLElement>(ASSISTANT_MD_SELECTOR))
    .filter((md) => outermostOwner(md) === null)
  return hits.length === 0 ? null : hits[hits.length - 1] ?? null
}

/**
 * Body at the clicked button's own ordinal: the plugin renders exactly one
 * button per finalized reply, so equal counts make the mapping exact — and
 * it stays correct when every strip shares a container (where "nearest by
 * ancestry" collapses to the first reply for all buttons).
 * @param port - the conversation scrollport.
 * @param anchor - the clicked per-turn button.
 * @param bodies - outermost bodies in document order.
 * @returns the body, or null when counts differ / the button is absent.
 */
function markdownByButtonOrdinal(
  port: HTMLElement,
  anchor: Element,
  bodies: readonly HTMLElement[],
): HTMLElement | null {
  const buttons = Array.from(port.querySelectorAll<HTMLElement>(TURN_BUTTON_SELECTOR))
  const at = buttons.indexOf(anchor as HTMLElement)
  if (at < 0 || buttons.length !== bodies.length) return null
  return bodies[at] ?? null
}

/**
 * Outermost markdown bodies in the pane, document order — nested containers
 * (a card rendering markdown inside markdown) collapse to their owner.
 * @param port - the conversation scrollport.
 * @returns the bodies.
 */
function outermostMarkdown(port: HTMLElement): HTMLElement[] {
  return Array.from(port.querySelectorAll<HTMLElement>(ASSISTANT_MD_SELECTOR))
    .filter((md) => outermostOwner(md) === null)
}

/**
 * User rows plus outermost bodies in document order — the sequence a "turn"
 * segment is read from (a question sits immediately before its reply).
 * @param port - the conversation scrollport.
 * @returns the rows.
 */
function messageRows(port: HTMLElement): HTMLElement[] {
  const sel = `${USER_ROW_SELECTOR}, ${ASSISTANT_MD_SELECTOR}`
  return Array.from(port.querySelectorAll<HTMLElement>(sel))
    .filter((node) => node.matches(USER_ROW_SELECTOR) || outermostOwner(node) === null)
}

/**
 * The outermost body immediately preceding the strip in document order
 * (strips render under their reply); falls forward to the first body after
 * the strip when it precedes every body.
 * @param port - the conversation scrollport.
 * @param anchor - the clicked per-turn button.
 * @param bodies - outermost bodies in document order.
 * @returns the body, or null when the button is not inside the pane.
 */
function precedingMarkdown(
  port: HTMLElement,
  anchor: Element,
  bodies: readonly HTMLElement[],
): HTMLElement | null {
  const seq = port.querySelectorAll<HTMLElement>(`${ASSISTANT_MD_SELECTOR}, ${TURN_BUTTON_SELECTOR}`)
  let passed = false
  let prev: HTMLElement | null = null
  for (const el of seq) {
    if (el === anchor) {
      passed = true
      continue
    }
    if (!el.matches(ASSISTANT_MD_SELECTOR) || outermostOwner(el) !== null) continue
    if (!passed) {
      // 按钮之前的最后一条正文（循环继续，后面离按钮更近的会覆盖）。
      prev = el
      continue
    }
    // 按钮之后才遇到正文：正常布局（动作条在回复下方）优先用 prev；
    // 只有按钮排在自己回复上方时 prev 为空，才回落到这条后继正文。
    return prev ?? el
  }
  return passed ? prev ?? bodies[0] ?? null : null
}

/**
 * Sanitize a string into a safe download-file stem: path/hostile characters
 * and runs of whitespace collapse to '-', capped at 60 chars.
 * @param raw - the proposed file name stem (e.g. the session title).
 * @returns the sanitized stem (never empty).
 */
export function safeFileStem(raw: string): string {
  const cleaned = raw.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return cleaned === '' ? 'conversation' : cleaned
}
