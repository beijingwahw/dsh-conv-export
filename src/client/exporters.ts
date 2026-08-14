/**
 * The three export sinks: Markdown download, PDF download, and a long PNG
 * rasterized through SVG foreignObject. All share the extracted turn list;
 * none touches the live transcript DOM.
 *
 * The PDF path never opens a print window: `window.print()` is a
 * window-modal dialog on several platforms (notably Windows Chrome) that
 * freezes the whole browser — including the app tab — until dismissed.
 * Instead the conversation is rasterized once, sliced into page-height
 * strips, JPEG-encoded, and wrapped into a minimal multi-page PDF that is
 * downloaded like any other file. Zero dialogs, zero freeze.
 *
 * No cordis, no React — pure DOM/canvas helpers, unit-testable against
 * jsdom (the raster paths degrade gracefully where canvas is unavailable).
 */
import type { ExtractedMessage } from './extract.ts'
import { safeFileStem } from './extract.ts'
import { t } from './i18n.ts'

/** Raster width of the export raster (CSS px; doubled for retina). */
const IMAGE_WIDTH = 800
/** Raster scale factor (2x retina). */
const IMAGE_SCALE = 2
/** Upper bound for the raster height (canvas limits). */
const IMAGE_MAX_HEIGHT = 16000
/** One PDF page's height in CSS px at IMAGE_WIDTH (A4 aspect ratio). */
const PAGE_CSS_HEIGHT = Math.round(IMAGE_WIDTH * 297 / 210)

/** The shared export stylesheet for the raster and the PDF pages. */
const EXPORT_CSS = `
  body { font: 14px/1.7 -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
         color: #1f2328; background: #fff; margin: 0; }
  .x-wrap { max-width: 720px; margin: 0 auto; padding: 32px 24px; }
  .x-title { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
  .x-turn { margin: 0 0 20px; }
  .x-role { font-size: 12px; font-weight: 600; color: #4b5563; margin: 0 0 6px; }
  .x-user { background: #f3f4f6; border-radius: 10px; padding: 10px 14px; white-space: pre-wrap; }
  .x-md pre { background: #f6f8fa; border: 1px solid #e5e7eb; border-radius: 8px;
              padding: 10px 12px; overflow-x: auto; font-size: 12.5px; line-height: 1.55; }
  .x-md code { font-family: ui-monospace, 'Cascadia Code', Consolas, monospace; font-size: .92em; }
  .x-md pre code { background: none; }
  .x-md :not(pre) > code { background: #f3f4f6; border-radius: 4px; padding: 1px 5px; }
  .x-md h1, .x-md h2, .x-md h3 { line-height: 1.35; margin: 18px 0 8px; }
  .x-md h1 { font-size: 19px; } .x-md h2 { font-size: 17px; } .x-md h3 { font-size: 15px; }
  .x-md ul, .x-md ol { padding-left: 22px; margin: 8px 0; }
  .x-md blockquote { border-left: 3px solid #d1d5db; margin: 8px 0; padding: 2px 12px; color: #4b5563; }
  .x-md table { border-collapse: collapse; } .x-md td, .x-md th { border: 1px solid #e5e7eb; padding: 4px 10px; }
`

/**
 * Trigger a client-side file download.
 * @param filename - the download file name.
 * @param mime - the blob MIME type.
 * @param data - the blob body.
 */
export function downloadBlob(filename: string, mime: string, data: BlobPart): void {
  const blob = new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => { URL.revokeObjectURL(url) }, 4000)
}

/**
 * Build the export body HTML (shared by the PDF pages and the long image).
 * @param title - the session title.
 * @param messages - the extracted turns.
 * @returns the body markup string.
 */
export function buildExportHtml(title: string, messages: readonly ExtractedMessage[]): string {
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const turns = messages.map(m => m.role === 'user'
    ? `<div class="x-turn"><p class="x-role">${esc(t('role.user'))}</p><div class="x-user">${esc(m.text)}</div></div>`
    : `<div class="x-turn"><p class="x-role">${esc(t('role.assistant'))}</p><div class="x-md">${m.html}</div></div>`)
    .join('')
  return `<div class="x-wrap"><h1 class="x-title">${esc(title)}</h1>${turns}</div>`
}

/**
 * Inline every <img> in a container as a data: URL so the SVG foreignObject
 * raster can embed them (external fetches are forbidden inside an SVG image).
 * @param root - the container whose images are inlined in place.
 */
async function inlineImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'))
  await Promise.all(imgs.map(async img => {
    const src = img.getAttribute('src') ?? ''
    if (src === '' || src.startsWith('data:')) return
    try {
      const res = await fetch(src)
      if (!res.ok) return
      const blob = await res.blob()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => { resolve(String(reader.result)) }
        reader.onerror = () => { reject(reader.error) }
        reader.readAsDataURL(blob)
      })
      img.setAttribute('src', dataUrl)
    } catch {
      // Unreachable image: drop it rather than taint/fail the raster.
      img.remove()
    }
  }))
}

/**
 * Render the export document offscreen and rasterize it onto a 2x canvas.
 * @param title - the session title.
 * @param messages - the extracted turns.
 * @returns the rasterized canvas (IMAGE_WIDTH * IMAGE_SCALE wide).
 * @throws when the runtime cannot rasterize.
 */
async function rasterize(title: string, messages: readonly ExtractedMessage[]): Promise<HTMLCanvasElement> {
  const stage = document.createElement('div')
  stage.style.cssText = 'position:fixed;left:-100000px;top:0;'
    + `width:${IMAGE_WIDTH}px;pointer-events:none;z-index:-1;`
  stage.innerHTML = buildExportHtml(title, messages)
  const style = document.createElement('style')
  style.textContent = EXPORT_CSS
  stage.prepend(style)
  document.body.appendChild(stage)
  try {
    await inlineImages(stage)
    // Let inlined images settle their layout.
    await new Promise(resolve => { setTimeout(resolve, 60) })
    const height = Math.min(Math.ceil(stage.scrollHeight), IMAGE_MAX_HEIGHT)

    // Serialize a clean clone: no offscreen offset (it would shift content
    // out of the SVG viewport), and an explicit XHTML namespace so the
    // foreignObject payload is well-formed for the rasterizer.
    const clone = stage.cloneNode(true) as HTMLElement
    clone.style.cssText = `width:${IMAGE_WIDTH}px;background:#ffffff;`
    clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
    const serialized = new XMLSerializer().serializeToString(clone)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${height}">`
      + `<foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`

    // Validate well-formedness before rasterizing.
    const probe = new DOMParser().parseFromString(svg, 'image/svg+xml')
    if (probe.querySelector('parsererror') !== null) throw new Error('svg serialize failed')

    const img = new Image()
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    await img.decode()

    const canvas = document.createElement('canvas')
    canvas.width = IMAGE_WIDTH * IMAGE_SCALE
    canvas.height = height * IMAGE_SCALE
    const ctx = canvas.getContext('2d')
    if (ctx === null) throw new Error('no 2d context')
    ctx.scale(IMAGE_SCALE, IMAGE_SCALE)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, IMAGE_WIDTH, height)
    ctx.drawImage(img, 0, 0, IMAGE_WIDTH, height)
    return canvas
  } finally {
    stage.remove()
  }
}

/** One PDF page's image payload. */
interface PdfPage {
  /** JPEG bytes (DCTDecode). */
  readonly jpeg: Uint8Array
  /** Logical width in CSS px. */
  readonly widthPx: number
  /** Logical height in CSS px. */
  readonly heightPx: number
}

/**
 * Assemble a minimal multi-page PDF, one JPEG per page.
 * @param pages - the page payloads in order.
 * @returns the PDF file bytes.
 */
export function buildPdf(pages: readonly PdfPage[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  let offset = 0
  const offsets: number[] = []
  const push = (data: string | Uint8Array): void => {
    const bytes = typeof data === 'string' ? enc.encode(data) : data
    chunks.push(bytes)
    offset += bytes.length
  }
  const beginObj = (num: number): void => {
    offsets[num] = offset
    push(`${num} 0 obj\n`)
  }
  const endObj = (): void => { push('endobj\n') }

  const count = pages.length
  push('%PDF-1.4\n')
  beginObj(1)
  push('<< /Type /Catalog /Pages 2 0 R >>\n')
  endObj()
  beginObj(2)
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')
  push(`<< /Type /Pages /Kids [${kids}] /Count ${count} >>\n`)
  endObj()
  pages.forEach((page, i) => {
    const pageNum = 3 + i * 3
    const imgNum = pageNum + 1
    const contentNum = pageNum + 2
    const wPt = (page.widthPx * 0.75).toFixed(2)
    const hPt = (page.heightPx * 0.75).toFixed(2)
    beginObj(pageNum)
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] `
      + `/Resources << /XObject << /Im0 ${imgNum} 0 R >> >> /Contents ${contentNum} 0 R >>\n`)
    endObj()
    beginObj(imgNum)
    push(`<< /Type /XObject /Subtype /Image /Width ${page.widthPx * IMAGE_SCALE} `
      + `/Height ${page.heightPx * IMAGE_SCALE} /ColorSpace /DeviceRGB /BitsPerComponent 8 `
      + `/Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`)
    push(page.jpeg)
    push('\nendstream\n')
    endObj()
    const stream = `q\n${wPt} 0 0 ${hPt} 0 0 cm\n/Im0 Do\nQ\n`
    beginObj(contentNum)
    push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream\n`)
    endObj()
  })

  const total = 2 + count * 3
  const xrefAt = offset
  push(`xref\n0 ${total + 1}\n0000000000 65535 f \n`)
  for (let n = 1; n <= total; n += 1) {
    push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`)
  }
  push(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`)

  const out = new Uint8Array(offset)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.length
  }
  return out
}

/**
 * Export as PDF: rasterize the conversation, slice it into page-height
 * strips, and download a self-contained multi-page PDF. No print dialog —
 * the app tab never freezes.
 * @param title - the session title (also the file stem, sanitized).
 * @param messages - the extracted turns.
 * @throws when the runtime cannot rasterize.
 */
export async function exportPdf(title: string, messages: readonly ExtractedMessage[]): Promise<void> {
  const canvas = await rasterize(title, messages)
  const slicePx = PAGE_CSS_HEIGHT * IMAGE_SCALE
  const pages: PdfPage[] = []
  for (let y = 0; y < canvas.height; y += slicePx) {
    const h = Math.min(slicePx, canvas.height - y)
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = h
    const ctx = slice.getContext('2d')
    if (ctx === null) throw new Error('no 2d context')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, slice.width, h)
    ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h)
    const jpeg = await new Promise<Blob | null>(resolve => { slice.toBlob(resolve, 'image/jpeg', 0.92) })
    if (jpeg === null) throw new Error('toBlob failed')
    pages.push({
      jpeg: new Uint8Array(await jpeg.arrayBuffer()),
      widthPx: IMAGE_WIDTH,
      heightPx: Math.ceil(h / IMAGE_SCALE),
    })
  }
  downloadBlob(`${safeFileStem(title)}.pdf`, 'application/pdf', buildPdf(pages))
}

/**
 * Export as a long PNG: rasterize the whole conversation and download one
 * tall image.
 * @param title - the session title (also the file stem, sanitized).
 * @param messages - the extracted turns.
 * @throws when the runtime cannot rasterize (no canvas / SVG parse failure).
 */
export async function exportImage(title: string, messages: readonly ExtractedMessage[]): Promise<void> {
  const canvas = await rasterize(title, messages)
  const blob = await new Promise<Blob | null>(resolve => { canvas.toBlob(resolve, 'image/png') })
  if (blob === null) throw new Error('toBlob failed')
  downloadBlob(`${safeFileStem(title)}.png`, 'image/png', blob)
}
