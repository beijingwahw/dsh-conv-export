/**
 * Rendered-HTML → Markdown serialization for assistant turns, plus the
 * document assembler shared by the Markdown and PDF exporters.
 *
 * The assistant transcript is React-rendered markdown (headings, lists,
 * code fences, tables, inline emphasis). Exporting it as Markdown requires
 * walking that DOM back into source form. This serializer covers the stock
 * renderer's element set; unknown elements degrade to their children, so
 * content is never dropped — only formatting may flatten.
 *
 * No cordis, no React — pure DOM helpers, unit-testable against jsdom.
 */
import type { ExtractedMessage } from './extract.ts'
import { t } from './i18n.ts'

/**
 * Serialize one inline subtree (no block structure) into markdown text.
 * @param node - the inline root.
 * @returns the inline markdown.
 */
function inline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.nodeValue ?? '').replace(/\s+/g, ' ')
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as HTMLElement
  const kids = (): string => Array.from(el.childNodes).map(inline).join('')
  switch (el.tagName) {
    case 'STRONG':
    case 'B': {
      const text = kids().trim()
      return text === '' ? '' : `**${text}**`
    }
    case 'EM':
    case 'I': {
      const text = kids().trim()
      return text === '' ? '' : `*${text}*`
    }
    case 'DEL':
    case 'S': {
      const text = kids().trim()
      return text === '' ? '' : `~~${text}~~`
    }
    case 'CODE': {
      const text = (el.textContent ?? '').trim()
      return text === '' ? '' : `\`${text}\``
    }
    case 'A': {
      const text = kids().trim()
      const href = el.getAttribute('href') ?? ''
      if (text === '' || href === '') return text
      return `[${text}](${href})`
    }
    case 'BR':
      return '\n'
    case 'IMG': {
      const alt = el.getAttribute('alt') ?? ''
      const src = el.getAttribute('src') ?? ''
      return src === '' ? alt : `![${alt}](${src})`
    }
    default:
      return kids()
  }
}

/**
 * Serialize one list element (ul/ol) with nesting indentation.
 * @param el - the list element.
 * @param depth - nesting depth (0 = top level).
 * @returns the markdown list lines.
 */
function list(el: HTMLElement, depth: number): string {
  const ordered = el.tagName === 'OL'
  const pad = '  '.repeat(depth)
  const lines: string[] = []
  let n = 1
  for (const li of Array.from(el.children).filter(c => c.tagName === 'LI')) {
    const bullet = ordered ? `${n}. ` : '- '
    n += 1
    // Inline content of the li = everything except nested lists.
    const inlineParts = Array.from(li.childNodes)
      .filter(c => !(c.nodeType === Node.ELEMENT_NODE && (c as HTMLElement).tagName === 'UL'
        || c.nodeType === Node.ELEMENT_NODE && (c as HTMLElement).tagName === 'OL'))
      .map(inline).join('')
    const nested = Array.from(li.children)
      .filter(c => c.tagName === 'UL' || c.tagName === 'OL')
      .map(c => list(c as HTMLElement, depth + 1)).join('')
    lines.push(`${pad}${bullet}${inlineParts.trim()}${nested === '' ? '' : `\n${nested}`}`)
  }
  return lines.join('\n')
}

/**
 * Serialize a table into a GitHub-flavored markdown table.
 * @param el - the table element.
 * @returns the markdown table text.
 */
function table(el: HTMLElement): string {
  const rows = Array.from(el.querySelectorAll('tr'))
  if (rows.length === 0) return ''
  const cells = (tr: Element): string[] => Array.from(tr.querySelectorAll('th, td'))
    .map(td => inline(td).trim().replace(/\|/g, '\\|'))
  const out: string[] = []
  rows.forEach((tr, i) => {
    out.push(`| ${cells(tr).join(' | ')} |`)
    if (i === 0) out.push(`| ${cells(tr).map(() => '---').join(' | ')} |`)
  })
  return out.join('\n')
}

/**
 * Serialize one block-level subtree into markdown.
 * @param node - the block root.
 * @returns the block markdown (blank-line separated).
 */
function block(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.nodeValue ?? '').trim()
    return text === '' ? '' : text
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as HTMLElement
  const kids = (): string => Array.from(el.childNodes).map(block).filter(s => s !== '').join('\n\n')
  switch (el.tagName) {
    case 'H1': return `# ${inline(el).trim()}`
    case 'H2': return `## ${inline(el).trim()}`
    case 'H3': return `### ${inline(el).trim()}`
    case 'H4': return `#### ${inline(el).trim()}`
    case 'H5': return `##### ${inline(el).trim()}`
    case 'H6': return `###### ${inline(el).trim()}`
    case 'PRE': {
      const code = el.querySelector('code')
      const lang = (code?.getAttribute('class') ?? '').match(/language-([\w+-]+)/)?.[1] ?? ''
      const text = (code?.textContent ?? el.textContent ?? '').replace(/\n$/, '')
      return `\`\`\`${lang}\n${text}\n\`\`\``
    }
    case 'UL':
    case 'OL':
      return list(el, 0)
    case 'BLOCKQUOTE':
      return kids().split('\n').map(l => `> ${l}`).join('\n')
    case 'HR':
      return '---'
    case 'TABLE':
      return table(el)
    case 'P':
    case 'DIV':
    case 'SECTION':
    case 'ARTICLE':
      return kids()
    case 'BR':
      return ''
    default:
      // Unknown block: keep inline reading when leaf-ish, else recurse.
      return el.children.length === 0 ? inline(el).trim() : kids()
  }
}

/**
 * Convert one assistant turn's rendered HTML back into markdown.
 * @param html - the markdown container's innerHTML.
 * @returns the serialized markdown (trimmed).
 */
export function htmlToMarkdown(html: string): string {
  const holder = document.createElement('div')
  holder.innerHTML = html
  return Array.from(holder.childNodes).map(block).filter(s => s !== '').join('\n\n').trim()
}

/**
 * Assemble the full export document.
 * @param title - the session title (null → generic heading).
 * @param messages - the extracted turns, in order.
 * @returns the markdown document text.
 */
export function buildMarkdown(title: string | null, messages: readonly ExtractedMessage[]): string {
  const parts: string[] = []
  parts.push(`# ${title ?? 'Conversation'}`)
  for (const msg of messages) {
    parts.push(`### ${msg.role === 'user' ? t('role.user') : t('role.assistant')}`)
    parts.push(msg.role === 'user' ? msg.text : htmlToMarkdown(msg.html))
  }
  return `${parts.join('\n\n')}\n`
}
