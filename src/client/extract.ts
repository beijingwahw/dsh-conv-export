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
  const el = document.querySelector(TITLE_SELECTOR)
  const text = el?.textContent?.trim()
  return text === '' || text === undefined ? null : (text ?? null)
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
      const bubble = node.querySelector(USER_BUBBLE_SELECTOR) ?? node
      const text = (bubble.textContent ?? '').trim()
      if (text !== '') out.push({ role: 'user', text, html: '' })
    } else {
      // Assistant markdown container; skip empty (still-streaming) shells.
      const text = (node.textContent ?? '').trim()
      if (text !== '') out.push({ role: 'assistant', text, html: node.innerHTML })
    }
  }
  return out
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
