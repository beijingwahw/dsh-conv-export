/**
 * The three export sinks: Markdown download, PDF via a print window, and a
 * long PNG rasterized through SVG foreignObject. All share the extracted
 * turn list; none touches the live transcript DOM.
 *
 * No cordis, no React — pure DOM/canvas helpers, unit-testable against
 * jsdom (the image path degrades gracefully where canvas is unavailable).
 */
import type { ExtractedMessage } from './extract.ts'
import { safeFileStem } from './extract.ts'
import { t } from './i18n.ts'

/** Raster width of the long image (CSS px; doubled for retina). */
const IMAGE_WIDTH = 800
/** Raster scale factor (2x retina). */
const IMAGE_SCALE = 2
/** Upper bound for the long image height (canvas limits). */
const IMAGE_MAX_HEIGHT = 16000

/** The shared export stylesheet for the print window and the long image. */
const EXPORT_CSS = `
  body { font: 14px/1.7 -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
         color: #1f2328; background: #fff; margin: 0; }
  .x-wrap { max-width: 720px; margin: 0 auto; padding: 32px 24px; }
  .x-title { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
  .x-meta { color: #6b7280; font-size: 12px; margin: 0 0 24px; }
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
  @media print { .x-wrap { max-width: none; padding: 0; } }
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
 * Build the export body HTML (shared by print window and long image).
 * @param title - the session title.
 * @param messages - the extracted turns.
 * @param exportedAt - ISO timestamp line.
 * @returns the body markup string.
 */
export function buildExportHtml(title: string, messages: readonly ExtractedMessage[], exportedAt: string): string {
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const turns = messages.map(m => m.role === 'user'
    ? `<div class="x-turn"><p class="x-role">${esc(t('role.user'))}</p><div class="x-user">${esc(m.text)}</div></div>`
    : `<div class="x-turn"><p class="x-role">${esc(t('role.assistant'))}</p><div class="x-md">${m.html}</div></div>`)
    .join('')
  return `<div class="x-wrap"><h1 class="x-title">${esc(title)}</h1>`
    + `<p class="x-meta">${esc(t('meta.exported'))} ${esc(exportedAt)}</p>${turns}</div>`
}

/**
 * Export as PDF: open a print window with the export document and invoke
 * its print dialog (user picks "Save as PDF").
 *
 * The print call lives in a script inside the NEW window, so it runs on the
 * new tab's own main thread: `print()` is synchronous and blocks its caller,
 * and calling it from the opener (as `win.print()`) would freeze the app tab
 * until the dialog closes. Self-invocation keeps the app tab responsive.
 * @param title - the session title.
 * @param messages - the extracted turns.
 * @param exportedAt - ISO timestamp line.
 */
export function exportPdf(title: string, messages: readonly ExtractedMessage[], exportedAt: string): void {
  const win = window.open('', '_blank')
  if (win === null) return
  win.document.write(`<!doctype html><html><head><meta charset="utf-8">`
    + `<title>${title.replace(/</g, '&lt;')}</title><style>${EXPORT_CSS}</style></head>`
    + `<body>${buildExportHtml(title, messages, exportedAt)}`
    + '<script>window.addEventListener("load", function () { setTimeout(function () { window.print() }, 60) })</script>'
    + '</body></html>')
  win.document.close()
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
 * Export as a long PNG: render the export document offscreen, measure it,
 * serialize it into an SVG foreignObject, rasterize on a 2x canvas, and
 * download the blob.
 * @param title - the session title (also the file stem, sanitized).
 * @param messages - the extracted turns.
 * @param exportedAt - ISO timestamp line.
 * @throws when the runtime cannot rasterize (no canvas / SVG parse failure).
 */
export async function exportImage(
  title: string,
  messages: readonly ExtractedMessage[],
  exportedAt: string,
): Promise<void> {
  const stage = document.createElement('div')
  stage.style.cssText = 'position:fixed;left:-100000px;top:0;'
    + `width:${IMAGE_WIDTH}px;pointer-events:none;z-index:-1;`
  stage.innerHTML = buildExportHtml(title, messages, exportedAt)
  // The stage needs the export stylesheet for measurement fidelity.
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

    const blob = await new Promise<Blob | null>(resolve => { canvas.toBlob(resolve, 'image/png') })
    if (blob === null) throw new Error('toBlob failed')
    downloadBlob(`${safeFileStem(title)}.png`, 'image/png', blob)
  } finally {
    stage.remove()
  }
}
