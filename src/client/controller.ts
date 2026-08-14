/**
 * The export controller: owns the header-triggered dropdown menu (plain DOM
 * — no React, so it never couples to the shell's React version) and
 * dispatches the three sinks (Markdown download, PDF print window, long
 * PNG). Extraction runs at click time, so the export always reflects the
 * transcript exactly as the reader sees it.
 *
 * Lifecycle: `install()` from the cordis apply (menu mount + outside-click
 * close), `uninstall()` on plugin unload.
 */
import { extractMessages, readTitle, resolveScope, safeFileStem } from './extract.ts'
import { buildMarkdown } from './markdown.ts'
import { downloadBlob, exportImage, exportPdf } from './exporters.ts'
import { t } from './i18n.ts'

/** Menu entry ids. */
type ExportKind = 'markdown' | 'pdf' | 'image'

/**
 * The singleton controller. A page hosts exactly one conversation pane, so
 * a module-level instance is the right ownership; cordis install/uninstall
 * bracket its DOM effects.
 */
class ExportController {
  private menu: HTMLElement | null = null
  private installed = false
  private busy = false

  /** Install the menu DOM and document listeners. Idempotent. */
  install(): void {
    if (this.installed) return
    this.installed = true
    this.mountMenu()
    document.addEventListener('pointerdown', this.onOutside, true)
    document.addEventListener('keydown', this.onKeyDown, true)
  }

  /** Remove every installed effect. Idempotent. */
  uninstall(): void {
    if (!this.installed) return
    this.installed = false
    document.removeEventListener('pointerdown', this.onOutside, true)
    document.removeEventListener('keydown', this.onKeyDown, true)
    this.menu?.remove()
    this.menu = null
  }

  /**
   * Toggle the dropdown (the header action button's gesture), anchoring it
   * under the triggering button.
   * @param anchor - the header action button (positions the menu).
   */
  toggle(anchor?: Element): void {
    if (this.menu === null) return
    if (resolveScope() === null) return
    // TS 6 types `hidden` as string | boolean (the until-found value); the
    // menu only ever holds booleans, so "not false" is the hidden state.
    const open = this.menu.hidden !== false
    this.menu.hidden = !open
    if (open && anchor instanceof HTMLElement) {
      const rect = anchor.getBoundingClientRect()
      const width = this.menu.offsetWidth
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
      this.menu.style.top = `${Math.round(rect.bottom + 6)}px`
      this.menu.style.left = `${Math.round(left)}px`
    }
    this.syncActionButton(open)
  }

  /** Close the dropdown. */
  close(): void {
    if (this.menu === null || this.menu.hidden) return
    this.menu.hidden = true
    this.syncActionButton(false)
  }

  // ------------------------------------------------------------------ menu

  /** Build the dropdown once and hide it until opened. */
  private mountMenu(): void {
    const menu = document.createElement('div')
    menu.setAttribute('data-dsh-conv-export-menu', '')
    menu.hidden = true
    menu.setAttribute('role', 'menu')

    const entries: Array<{ kind: ExportKind; label: string }> = [
      { kind: 'markdown', label: t('menu.markdown') },
      { kind: 'pdf', label: t('menu.pdf') },
      { kind: 'image', label: t('menu.image') },
    ]
    for (const entry of entries) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.setAttribute('role', 'menuitem')
      btn.setAttribute('data-export-kind', entry.kind)
      btn.textContent = entry.label
      btn.addEventListener('click', () => { void this.run(entry.kind) })
      menu.appendChild(btn)
    }
    document.body.appendChild(menu)
    this.menu = menu
  }

  /** Mirror the open state onto the header action button. */
  private syncActionButton(open: boolean): void {
    const btn = document.querySelector('.dsh-conv-export-action')
    if (btn === null) return
    btn.setAttribute('aria-pressed', String(open))
  }

  /** Close on any pointer-down outside the menu and its action button. */
  private readonly onOutside = (e: PointerEvent): void => {
    if (this.menu === null || this.menu.hidden) return
    const target = e.target
    if (!(target instanceof Node)) return
    if (this.menu.contains(target)) return
    if (target instanceof Element && target.closest('.dsh-conv-export-action') !== null) return
    this.close()
  }

  /** Escape closes the menu. */
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close()
  }

  // --------------------------------------------------------------- export

  /**
   * Run one export sink against the currently rendered transcript.
   * @param kind - which sink to run.
   */
  private async run(kind: ExportKind): Promise<void> {
    if (this.busy) return
    const messages = extractMessages()
    if (messages.length === 0) return
    const title = readTitle() ?? 'Conversation'
    const stem = safeFileStem(title)
    this.busy = true
    try {
      if (kind === 'markdown') {
        downloadBlob(`${stem}.md`, 'text/markdown;charset=utf-8', buildMarkdown(title, messages))
      } else if (kind === 'pdf') {
        await exportPdf(title, messages)
      } else {
        await exportImage(title, messages)
      }
    } catch {
      // Long-image raster failures degrade to a visible toast.
      this.toast(t('toast.imageFail'))
    } finally {
      this.busy = false
      this.close()
    }
  }

  /**
   * Show a transient toast (bottom-center) for export failures.
   * @param text - the message to show.
   */
  private toast(text: string): void {
    const el = document.createElement('div')
    el.setAttribute('data-dsh-conv-export-toast', '')
    el.textContent = text
    document.body.appendChild(el)
    setTimeout(() => { el.remove() }, 3200)
  }
}

/** The page-wide controller instance. */
export const controller = new ExportController()
