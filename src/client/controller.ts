/**
 * The export controller: owns the header-triggered dropdown menu (plain DOM
 * — no React, so it never couples to the shell's React version) and
 * dispatches the five sinks (Markdown download, single-file HTML download,
 * PDF download, long PNG, clipboard copy). Extraction runs at click time, so
 * the export always reflects the transcript exactly as the reader sees it.
 *
 * 光栅导出（PDF/PNG）带分片进度：进行中菜单项实时显示「done/total」
 * 计数；再次点击同一菜单项取消进行中的导出（AbortError → 已取消提示）。
 *
 * 选择导出（turn selection）：菜单第四项打开回合选择面板，逐回合勾选
 * （角色 + 内容预览，默认全选）、全选/全不选、挑选格式，确认后仅导出
 * 选中回合。面板同为纯 DOM（遮罩 + 对话框），与菜单共用同一套生命周期、
 * 键盘/外点关闭纪律与设计令牌；导出进行中确认按钮显示分片进度，
 * 再次点击或「取消」中止。
 *
 * 批量导出（batch export，能力吸收自 dsh-companion）：菜单第五项打开
 * 会话选择面板——拉取历史会话列表（宿主 GET /conv-export/sessions）、
 * 按标题/ID 实时筛选、逐个勾选、全选/全不选（作用于当前筛选结果并与
 * 已有选择取并集）、已选计数；确认后 POST /conv-export/batch 将所选
 * 会话各生成一份 Markdown 打包为 ZIP 下载。打包进行中确认按钮显示
 * 「正在打包…」，再次点击或「取消」中止；与回合面板共用遮罩/对话框
 * 骨架与关闭纪律（打包期间 Esc / 遮罩不关闭，以中止按钮为唯一出口）。
 *
 * Lifecycle: `install()` from the cordis apply (menu mount + outside-click
 * close), `uninstall()` on plugin unload.
 */
import { extractMessages, readTitle, resolveScope, safeFileStem } from './extract.ts'
import type { ExtractedMessage } from './extract.ts'
import { buildMarkdown } from './markdown.ts'
import { copyText, downloadBlob, exportHtml, exportImage, exportPdf } from './exporters.ts'
import { fetchBatchSessions, runBatchExport, type BatchSession } from './batch.ts'
import { t } from './i18n.ts'

/** Export sink ids. */
type ExportKind = 'markdown' | 'html' | 'pdf' | 'image' | 'copy'

/** Menu entry ids — 'select' opens the turn panel, 'batch' the session panel. */
type MenuKind = ExportKind | 'select' | 'batch'

/**
 * 线性图标集（16px viewBox，stroke currentColor 随文字色）。静态常量字符串
 * 经 innerHTML 注入，不含任何用户输入。
 */
const ICONS = {
  markdown:
    '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.25" y="2.25" width="9.5" height="11.5" rx="1.9"/><path d="M5.8 5.9h4.4M5.8 8.2h4.4M5.8 10.5h2.8"/></svg>',
  pdf:
    '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2.5h5.5L13 6v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13V4a1.5 1.5 0 0 1 1-1.5z"/><path d="M9.3 2.8V6h3.4"/></svg>',
  html:
    '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2.5h5.5L13 6v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13V4a1.5 1.5 0 0 1 1-1.5z"/><path d="M6.2 7.2L4.9 8.5l1.3 1.3M9.8 7.2l1.3 1.3-1.3 1.3M8.5 6.9l-1 3.2"/></svg>',
  copy:
    '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.25" y="5.25" width="8" height="8" rx="1.6"/><path d="M10.75 5.25V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5.25a1.5 1.5 0 0 0 1.5 1.5h1.25"/></svg>',
  image:
    '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.75" y="3.25" width="10.5" height="9.5" rx="1.9"/><circle cx="6.1" cy="6.7" r="1.05"/><path d="M4.7 12l2.8-2.9 1.9 2 1.3-1.3 2.4 2.3"/></svg>',
  select:
    '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.8 4.7l1.4 1.4 2.6-2.9"/><path d="M8.7 4.6h4.5"/><path d="M2.8 10.7l1.4 1.4 2.6-2.9"/><path d="M8.7 10.6h4.5"/></svg>',
  batch:
    '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.6l5.3 2.7L8 8 2.7 5.3 8 2.6z"/><path d="M3 8.5l5 2.6 5-2.6"/><path d="M3 11.3l5 2.6 5-2.6"/></svg>',
  close:
    '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4.6 4.6l6.8 6.8M11.4 4.6l-6.8 6.8"/></svg>',
  chevron:
    '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.2 3.6L10.6 8l-4.4 4.4"/></svg>',
} as const

/**
 * 写入按钮标签：按钮内含 [data-cx-label] 容器时写入之，保留图标/标签/
 * spinner 等结构（直接写 textContent 会清空它们）。
 * @param btn - 目标按钮。
 * @param text - 标签文案。
 */
function setButtonLabel(btn: HTMLElement, text: string): void {
  const host = btn.querySelector<HTMLElement>('[data-cx-label]')
  if (host !== null) host.textContent = text
  else btn.textContent = text
}

/** 进行中的光栅导出：类别 + 取消控制器。 */
interface RunningExport {
  readonly kind: ExportKind
  readonly abort: AbortController
}

/** 进度宿主：导出期间被写入「基础标签 done/total」的元素。 */
interface ProgressTarget {
  readonly el: HTMLElement | null
  readonly baseLabel: string
}

/**
 * 回合预览文案：压缩空白并截断至 80 字符（选择面板条目）。
 * 纯函数，导出仅为单测。
 * @param message - 抽取出的对话回合。
 */
export function previewOf(message: ExtractedMessage): string {
  const flat = message.text.replace(/\s+/g, ' ').trim()
  return flat.length > 80 ? `${flat.slice(0, 80)}…` : flat
}

/** 面板列表内的提示行类型：加载中 / 加载失败 / 空 / 无匹配。 */
type NoteKind = 'loading' | 'error' | 'empty'

/**
 * 面板列表内的提示行（带状态图标：loading = spinner、error = 琥珀、
 * empty = 收件匣），供 CSS 按类型渲染图标。
 * @param text - 提示文案。
 * @param kind - 状态类型。
 */
function note(text: string, kind: NoteKind): HTMLDivElement {
  const el = document.createElement('div')
  el.setAttribute('data-dsh-conv-export-panel-note', '')
  el.setAttribute('data-cx-kind', kind)
  el.textContent = text
  return el
}

/**
 * The singleton controller. A page hosts exactly one conversation pane, so
 * a module-level instance is the right ownership; cordis install/uninstall
 * bracket its DOM effects.
 */
class ExportController {
  private menu: HTMLElement | null = null
  /** 选择面板（backdrop 元素；回合面板与批量面板共用此槽位）；null = 未打开。 */
  private panel: HTMLElement | null = null
  private installed = false
  private running: RunningExport | null = null
  /** 批量面板：会话列表拉取的取消控制器（面板关闭时中止）。 */
  private batchListAbort: AbortController | null = null
  /** 批量面板：打包请求的取消控制器（非 null 期间面板不可关闭）。 */
  private batchRun: AbortController | null = null

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
    this.closePanel()
  }

  /**
   * Toggle the dropdown (the header action button's gesture), anchoring it
   * under the triggering button. 选择面板打开时不弹菜单。
   * @param anchor - the header action button (positions the menu).
   */
  toggle(anchor?: Element): void {
    if (this.menu === null) return
    if (this.panel !== null) return
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

    /** 菜单项视觉规格：图标 + 文案 + 右侧标注（格式标签或子面板箭头）。 */
    const entries: Array<{
      kind: MenuKind
      label: string
      icon: string
      tag?: string
      chevron?: boolean
    }> = [
      { kind: 'markdown', label: t('menu.markdown'), icon: ICONS.markdown, tag: '.md' },
      { kind: 'html', label: t('menu.html'), icon: ICONS.html, tag: '.html' },
      { kind: 'pdf', label: t('menu.pdf'), icon: ICONS.pdf, tag: 'A4' },
      { kind: 'image', label: t('menu.image'), icon: ICONS.image, tag: 'PNG' },
      { kind: 'copy', label: t('menu.copy'), icon: ICONS.copy },
      { kind: 'select', label: t('menu.select'), icon: ICONS.select, chevron: true },
      { kind: 'batch', label: t('menu.batch'), icon: ICONS.batch, chevron: true },
    ]
    for (const entry of entries) {
      // 分隔线：区分「快捷导出」与「选择 / 批量导出」。
      if (entry.kind === 'select') {
        const divider = document.createElement('hr')
        menu.appendChild(divider)
      }
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.setAttribute('role', 'menuitem')
      btn.setAttribute('data-export-kind', entry.kind)
      const ico = document.createElement('span')
      ico.setAttribute('data-cx-ico', '')
      ico.innerHTML = entry.icon
      const label = document.createElement('span')
      label.setAttribute('data-cx-label', '')
      label.textContent = entry.label
      btn.append(ico, label)
      if (entry.tag !== undefined) {
        const tag = document.createElement('span')
        tag.setAttribute('data-cx-tag', '')
        tag.textContent = entry.tag
        btn.appendChild(tag)
      }
      if (entry.chevron === true) {
        const chevron = document.createElement('span')
        chevron.setAttribute('data-cx-chevron', '')
        chevron.innerHTML = ICONS.chevron
        btn.appendChild(chevron)
      }
      btn.addEventListener('click', () => {
        if (entry.kind === 'select') {
          this.openSelection()
          return
        }
        if (entry.kind === 'batch') {
          this.openBatch()
          return
        }
        void this.run(entry.kind)
      })
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
    const target = e.target
    if (!(target instanceof Node)) return
    // 选择/批量面板打开：点击遮罩关闭（导出/打包进行中不允许，须经取消按钮）。
    if (this.panel !== null) {
      if (this.panel === target && this.running === null && this.batchRun === null) this.closePanel()
      return
    }
    if (this.menu === null || this.menu.hidden) return
    if (this.menu.contains(target)) return
    if (target instanceof Element && target.closest('.dsh-conv-export-action') !== null) return
    this.close()
  }

  /** Escape closes the menu / the idle selection panel. */
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return
    if (this.panel !== null) {
      if (this.running === null && this.batchRun === null) this.closePanel()
      return
    }
    this.close()
  }

  // --------------------------------------------------------------- export

  /** 菜单基础标签文案（进度显示复用）。 */
  private menuLabel(kind: ExportKind): string {
    if (kind === 'markdown') return t('menu.markdown')
    if (kind === 'html') return t('menu.html')
    if (kind === 'pdf') return t('menu.pdf')
    if (kind === 'copy') return t('menu.copy')
    return t('menu.image')
  }

  /**
   * Run one export sink against the currently rendered transcript.
   * 光栅导出进行中时，再次点击同一菜单项触发取消。
   * @param kind - which sink to run.
   */
  private async run(kind: ExportKind): Promise<void> {
    if (this.running !== null) {
      if (this.running.kind === kind) this.running.abort.abort()
      return
    }
    const messages = extractMessages()
    if (messages.length === 0) return
    const button = this.menu?.querySelector(`[data-export-kind="${kind}"]`) ?? null
    try {
      await this.execute(kind, messages, {
        el: button instanceof HTMLElement ? button : null,
        baseLabel: this.menuLabel(kind),
      })
    } finally {
      this.close()
    }
  }

  /**
   * 执行一次导出（菜单全量与面板筛选共用）：进度写入宿主元素
   * 「基础标签 done/total」，完成后复位；取消以 AbortError 落入已取消提示。
   * @param kind - 导出汇。
   * @param messages - 导出的回合列表（面板路径为筛选后的子集）。
   * @param progress - 进度宿主（可缺省）。
   */
  private async execute(
    kind: ExportKind,
    messages: readonly ExtractedMessage[],
    progress?: ProgressTarget,
  ): Promise<void> {
    const title = readTitle() ?? 'Conversation'
    const stem = safeFileStem(title)
    const abort = new AbortController()
    this.running = { kind, abort }
    const onProgress = (done: number, total: number): void => {
      if (progress !== undefined && progress.el !== null) {
        setButtonLabel(progress.el, `${progress.baseLabel} ${done}/${total}`)
      }
    }
    if (progress !== undefined && progress.el !== null) {
      progress.el.setAttribute('data-cx-state', 'running')
    }
    try {
      if (kind === 'markdown') {
        downloadBlob(`${stem}.md`, 'text/markdown;charset=utf-8', buildMarkdown(title, messages))
      } else if (kind === 'copy') {
        await copyText(buildMarkdown(title, messages))
        this.toast(t('toast.copyDone'))
      } else if (kind === 'html') {
        await exportHtml(title, messages, { signal: abort.signal })
      } else if (kind === 'pdf') {
        await exportPdf(title, messages, { signal: abort.signal, onProgress })
      } else {
        await exportImage(title, messages, { signal: abort.signal, onProgress })
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        this.toast(t('toast.cancelled'))
      } else if (kind === 'copy') {
        // 剪贴板不可用（非安全上下文 / 无权限）：降级提示改走下载。
        this.toast(t('toast.copyFail'))
      } else if (kind === 'image') {
        // Raster failures degrade to a visible toast.
        this.toast(t('toast.imageFail'))
      } else {
        this.toast(t('toast.exportFail'))
      }
    } finally {
      this.running = null
      if (progress !== undefined && progress.el !== null) {
        progress.el.removeAttribute('data-cx-state')
        setButtonLabel(progress.el, progress.baseLabel)
      }
    }
  }

  // -------------------------------------------------------- selection panel

  /** 关闭选择/批量面板（幂等）：中止批量面板的在途请求后移除 DOM。 */
  private closePanel(): void {
    this.batchListAbort?.abort()
    this.batchListAbort = null
    this.batchRun?.abort()
    this.batchRun = null
    this.panel?.remove()
    this.panel = null
  }

  /**
   * 打开回合选择面板：逐回合勾选（默认全选）+ 格式挑选，确认后仅导出
   * 选中回合。导出期间确认按钮显示分片进度，再次点击或「取消」中止；
   * 面板随导出结束（含取消）自动关闭。
   */
  private openSelection(): void {
    // 批量打包进行中不开回合面板（其完成回调会关闭当前面板）。
    if (this.batchRun !== null) return
    const messages = extractMessages()
    if (messages.length === 0) return
    this.close()
    this.closePanel()

    const checked: boolean[] = messages.map(() => true)
    let format: ExportKind = 'markdown'

    const backdrop = document.createElement('div')
    backdrop.setAttribute('data-dsh-conv-export-panel-backdrop', '')
    const panel = document.createElement('div')
    panel.setAttribute('data-dsh-conv-export-panel', '')
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')
    panel.setAttribute('aria-label', t('panel.title'))

    // 头部：图标芯片 + 标题/副题 + 关闭按钮。
    const title = document.createElement('div')
    title.setAttribute('data-dsh-conv-export-panel-title', '')
    const titleIco = document.createElement('span')
    titleIco.setAttribute('data-cx-ico', '')
    titleIco.innerHTML = ICONS.select
    const head = document.createElement('span')
    head.setAttribute('data-cx-head', '')
    const titleText = document.createElement('span')
    titleText.setAttribute('data-cx-title', '')
    titleText.textContent = t('panel.title')
    const caption = document.createElement('span')
    caption.setAttribute('data-cx-caption', '')
    caption.textContent = t('panel.caption')
    head.append(titleText, caption)
    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.setAttribute('data-cx-close', '')
    closeBtn.setAttribute('aria-label', t('panel.close'))
    closeBtn.innerHTML = ICONS.close
    title.append(titleIco, head, closeBtn)
    panel.appendChild(title)

    // 工具行：全选/全不选分段控件 + 已选计数。
    const toolbar = document.createElement('div')
    toolbar.setAttribute('data-dsh-conv-export-panel-toolbar', '')
    const seg = document.createElement('div')
    seg.setAttribute('data-cx-seg', '')
    const allBtn = document.createElement('button')
    allBtn.type = 'button'
    allBtn.textContent = t('panel.selectAll')
    const noneBtn = document.createElement('button')
    noneBtn.type = 'button'
    noneBtn.textContent = t('panel.selectNone')
    seg.append(allBtn, noneBtn)
    const count = document.createElement('span')
    count.setAttribute('data-dsh-conv-export-panel-count', '')
    toolbar.append(seg, count)
    panel.appendChild(toolbar)

    // 回合列表：label 包裹 checkbox，点整行即切换；入场做 capped 交错。
    const list = document.createElement('div')
    list.setAttribute('data-dsh-conv-export-panel-list', '')
    list.setAttribute('data-cx-stagger', '')
    const boxes: HTMLInputElement[] = []
    messages.forEach((message, i) => {
      const row = document.createElement('label')
      row.setAttribute('data-dsh-conv-export-panel-item', '')
      row.setAttribute('data-role', message.role)
      const box = document.createElement('input')
      box.type = 'checkbox'
      box.checked = true
      box.addEventListener('change', () => {
        checked[i] = box.checked
        sync()
      })
      boxes.push(box)
      const role = document.createElement('span')
      role.setAttribute('data-dsh-conv-export-panel-item-role', '')
      role.textContent = t(message.role === 'user' ? 'role.user' : 'role.assistant')
      const text = document.createElement('span')
      text.setAttribute('data-dsh-conv-export-panel-item-text', '')
      text.textContent = previewOf(message)
      // 悬停提示展示更长内容（预览截断的补充）。
      text.title = message.text.slice(0, 300)
      row.append(box, role, text)
      list.appendChild(row)
    })
    panel.appendChild(list)

    // 格式行：内嵌分段单选（aria-pressed 镜像激活态）。
    const formatRow = document.createElement('div')
    formatRow.setAttribute('data-dsh-conv-export-panel-format', '')
    const formatLabel = document.createElement('span')
    formatLabel.setAttribute('data-dsh-conv-export-panel-format-label', '')
    formatLabel.textContent = t('panel.format')
    const formatGroup = document.createElement('div')
    formatGroup.setAttribute('data-cx-group', '')
    const formatBtns = new Map<ExportKind, HTMLButtonElement>()
    for (const kind of ['markdown', 'html', 'pdf', 'image'] as const) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.setAttribute('data-dsh-conv-export-panel-format-option', '')
      btn.setAttribute('aria-pressed', String(kind === format))
      btn.textContent = this.menuLabel(kind)
      btn.addEventListener('click', () => {
        format = kind
        for (const [k, b] of formatBtns) b.setAttribute('aria-pressed', String(k === format))
      })
      formatBtns.set(kind, btn)
      formatGroup.appendChild(btn)
    }
    formatRow.append(formatLabel, formatGroup)
    panel.appendChild(formatRow)

    // 底部按钮：取消 + 导出（标签写入 [data-cx-label]，运行态由 CSS 呈现）。
    const footer = document.createElement('div')
    footer.setAttribute('data-dsh-conv-export-panel-footer', '')
    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.setAttribute('data-dsh-conv-export-panel-secondary', '')
    cancelBtn.textContent = t('panel.cancel')
    const confirmBtn = document.createElement('button')
    confirmBtn.type = 'button'
    confirmBtn.setAttribute('data-dsh-conv-export-panel-primary', '')
    const confirmLabel = document.createElement('span')
    confirmLabel.setAttribute('data-cx-label', '')
    confirmBtn.appendChild(confirmLabel)
    footer.append(cancelBtn, confirmBtn)
    panel.appendChild(footer)

    /** 同步计数与导出按钮（导出进行中不打扰进度文案）。 */
    const sync = (): void => {
      const n = checked.filter(Boolean).length
      count.textContent = `${t('panel.selected')} ${n}/${messages.length}`
      if (this.running === null) {
        confirmBtn.disabled = n === 0
        setButtonLabel(confirmBtn, n === 0 ? t('panel.empty') : `${t('panel.export')} (${n})`)
      }
    }
    sync()

    allBtn.addEventListener('click', () => {
      checked.fill(true)
      for (const box of boxes) box.checked = true
      sync()
    })
    noneBtn.addEventListener('click', () => {
      checked.fill(false)
      for (const box of boxes) box.checked = false
      sync()
    })
    /** 请求关闭：导出进行中先中止，空闲则直接关面板（取消/关闭共用）。 */
    const requestClose = (): void => {
      if (this.running !== null) {
        this.running.abort.abort()
        return
      }
      this.closePanel()
    }
    cancelBtn.addEventListener('click', requestClose)
    closeBtn.addEventListener('click', requestClose)
    confirmBtn.addEventListener('click', () => {
      // 导出进行中：再次点击确认 = 中止（进度文案所在按钮即取消入口）。
      if (this.running !== null) {
        this.running.abort.abort()
        return
      }
      const selected = messages.filter((_, i) => checked[i])
      if (selected.length === 0) return
      void this.execute(format, selected, {
        el: confirmBtn,
        baseLabel: `${t('panel.export')} (${selected.length})`,
      }).then(() => {
        this.closePanel()
      })
    })

    backdrop.appendChild(panel)
    document.body.appendChild(backdrop)
    this.panel = backdrop
  }

  // ----------------------------------------------------------- batch panel

  /**
   * 打开批量导出面板（能力吸收自 dsh-companion）：拉取历史会话列表，
   * 按标题/ID 实时筛选、逐个勾选、全选/全不选（作用于当前筛选结果并与
   * 已有选择取并集）、已选计数；确认后将所选会话各生成一份 Markdown
   * 打包为 ZIP 下载（单次最多 100 个会话，自动去重，读取失败自动跳过）。
   * 打包进行中确认按钮显示「正在打包…」，再次点击或「取消」中止。
   */
  private openBatch(): void {
    // 单会话导出进行中不开面板（其完成回调会关闭本面板）。
    if (this.running !== null) return
    this.close()
    this.closePanel()

    const checked = new Set<string>()
    let sessions: readonly BatchSession[] = []
    let keyword = ''
    let loading = true
    let loadError = false

    const backdrop = document.createElement('div')
    backdrop.setAttribute('data-dsh-conv-export-panel-backdrop', '')
    const panel = document.createElement('div')
    panel.setAttribute('data-dsh-conv-export-panel', '')
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')
    panel.setAttribute('aria-label', t('batch.title'))

    // 头部：图标芯片 + 标题/副题 + 关闭按钮。
    const title = document.createElement('div')
    title.setAttribute('data-dsh-conv-export-panel-title', '')
    const titleIco = document.createElement('span')
    titleIco.setAttribute('data-cx-ico', '')
    titleIco.innerHTML = ICONS.batch
    const head = document.createElement('span')
    head.setAttribute('data-cx-head', '')
    const titleText = document.createElement('span')
    titleText.setAttribute('data-cx-title', '')
    titleText.textContent = t('batch.title')
    const caption = document.createElement('span')
    caption.setAttribute('data-cx-caption', '')
    caption.textContent = t('batch.caption')
    head.append(titleText, caption)
    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.setAttribute('data-cx-close', '')
    closeBtn.setAttribute('aria-label', t('panel.close'))
    closeBtn.innerHTML = ICONS.close
    title.append(titleIco, head, closeBtn)
    panel.appendChild(title)

    // 工具行：全选/全不选分段控件 + 已选计数。
    const toolbar = document.createElement('div')
    toolbar.setAttribute('data-dsh-conv-export-panel-toolbar', '')
    const seg = document.createElement('div')
    seg.setAttribute('data-cx-seg', '')
    const allBtn = document.createElement('button')
    allBtn.type = 'button'
    allBtn.textContent = t('panel.selectAll')
    const noneBtn = document.createElement('button')
    noneBtn.type = 'button'
    noneBtn.textContent = t('panel.selectNone')
    seg.append(allBtn, noneBtn)
    const count = document.createElement('span')
    count.setAttribute('data-dsh-conv-export-panel-count', '')
    toolbar.append(seg, count)
    panel.appendChild(toolbar)

    // 筛选框：按标题/ID 实时过滤（纯客户端，不分发服务端）。
    const search = document.createElement('input')
    search.type = 'search'
    search.setAttribute('data-dsh-conv-export-batch-search', '')
    search.placeholder = t('batch.search')
    search.addEventListener('input', () => {
      keyword = search.value
      renderList()
    })
    panel.appendChild(search)

    // 会话列表：label 包裹 checkbox，点整行即切换。
    const list = document.createElement('div')
    list.setAttribute('data-dsh-conv-export-panel-list', '')
    panel.appendChild(list)

    // 底部按钮：取消 + 导出（标签写入 [data-cx-label]，打包态由 CSS 呈现）。
    const footer = document.createElement('div')
    footer.setAttribute('data-dsh-conv-export-panel-footer', '')
    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.setAttribute('data-dsh-conv-export-panel-secondary', '')
    cancelBtn.textContent = t('panel.cancel')
    const confirmBtn = document.createElement('button')
    confirmBtn.type = 'button'
    confirmBtn.setAttribute('data-dsh-conv-export-panel-primary', '')
    const confirmLabel = document.createElement('span')
    confirmLabel.setAttribute('data-cx-label', '')
    confirmBtn.appendChild(confirmLabel)
    footer.append(cancelBtn, confirmBtn)
    panel.appendChild(footer)

    /** 当前筛选结果（标题或 ID 子串匹配，大小写不敏感）。 */
    const filtered = (): readonly BatchSession[] => {
      const kw = keyword.trim().toLowerCase()
      if (!kw) return sessions
      return sessions.filter(
        (s) => (s.title ?? '').toLowerCase().includes(kw) || s.id.toLowerCase().includes(kw),
      )
    }

    /** 列表状态渲染：加载中 / 加载失败（重试）/ 空 / 无匹配 / 会话行。 */
    const renderList = (): void => {
      list.textContent = ''
      if (loading) {
        list.appendChild(note(t('batch.loading'), 'loading'))
        return
      }
      if (loadError) {
        const retry = document.createElement('button')
        retry.type = 'button'
        retry.textContent = t('batch.retry')
        retry.addEventListener('click', () => { load() })
        const row = note(t('batch.loadFail'), 'error')
        row.appendChild(retry)
        list.appendChild(row)
        return
      }
      if (sessions.length === 0) {
        list.appendChild(note(t('batch.empty'), 'empty'))
        return
      }
      const rows = filtered()
      if (rows.length === 0) {
        list.appendChild(note(t('batch.noMatch'), 'empty'))
        return
      }
      for (const session of rows) {
        const row = document.createElement('label')
        row.setAttribute('data-dsh-conv-export-panel-item', '')
        const box = document.createElement('input')
        box.type = 'checkbox'
        box.checked = checked.has(session.id)
        box.addEventListener('change', () => {
          if (box.checked) checked.add(session.id)
          else checked.delete(session.id)
          sync()
        })
        const name = document.createElement('span')
        name.setAttribute('data-dsh-conv-export-batch-name', '')
        const display = session.title ?? session.id
        name.textContent = display
        // 悬停提示展示完整标题（列表内单行截断的补充）。
        name.title = display
        const time = document.createElement('span')
        time.setAttribute('data-dsh-conv-export-batch-time', '')
        time.textContent = new Date(session.createdAt).toLocaleString(undefined, { hour12: false })
        row.append(box, name, time)
        list.appendChild(row)
      }
    }

    /** 同步计数与导出按钮（打包进行中不打扰进度文案）。 */
    const sync = (): void => {
      count.textContent = `${t('panel.selected')} ${checked.size}/${sessions.length}`
      if (this.batchRun === null) {
        confirmBtn.disabled = checked.size === 0
        setButtonLabel(confirmBtn, checked.size === 0
          ? t('batch.minSelect')
          : `${t('panel.export')} (${checked.size})`)
      }
    }
    sync()

    /** 拉取会话列表（打开时与失败重试共用；面板关闭时中止在途请求）。 */
    const load = (): void => {
      loading = true
      loadError = false
      renderList()
      const abort = new AbortController()
      this.batchListAbort = abort
      fetchBatchSessions(abort.signal)
        .then((rows) => {
          if (abort.signal.aborted || this.panel !== backdrop) return
          sessions = rows
          loading = false
          renderList()
          sync()
        })
        .catch((error: unknown) => {
          if (abort.signal.aborted || this.panel !== backdrop) return
          if (error instanceof DOMException && error.name === 'AbortError') return
          loading = false
          loadError = true
          renderList()
        })
        .finally(() => {
          if (this.batchListAbort === abort) this.batchListAbort = null
        })
    }

    /** 执行批量导出：POST /conv-export/batch → ZIP 下载；中止信号贯穿请求。 */
    const runBatch = (): void => {
      const ids = sessions.filter((s) => checked.has(s.id)).map((s) => s.id)
      if (ids.length === 0) return
      const abort = new AbortController()
      this.batchRun = abort
      // 保持可点击：进行中再次点击确认即中止（与回合面板同一交互纪律）。
      confirmBtn.disabled = false
      confirmBtn.setAttribute('data-cx-state', 'running')
      setButtonLabel(confirmBtn, t('batch.packing'))
      runBatchExport(ids, abort.signal)
        .then(() => {
          this.toast(t('batch.done'))
          this.closePanel()
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') {
            this.toast(t('batch.cancelled'))
          } else {
            this.toast(error instanceof Error && error.message.length > 0 ? error.message : t('batch.fail'))
          }
        })
        .finally(() => {
          if (this.batchRun === abort) this.batchRun = null
          confirmBtn.removeAttribute('data-cx-state')
          sync()
        })
    }

    allBtn.addEventListener('click', () => {
      // 全选作用于当前筛选结果并与已有选择取并集（筛选时即「选中全部匹配项」，
      // 不匹配的已选会话保持选中不被清除）。
      for (const session of filtered()) checked.add(session.id)
      renderList()
      sync()
    })
    noneBtn.addEventListener('click', () => {
      checked.clear()
      renderList()
      sync()
    })
    /** 请求关闭：打包进行中先中止，空闲则直接关面板（取消/关闭共用）。 */
    const requestClose = (): void => {
      if (this.batchRun !== null) {
        this.batchRun.abort()
        return
      }
      this.closePanel()
    }
    cancelBtn.addEventListener('click', requestClose)
    closeBtn.addEventListener('click', requestClose)
    confirmBtn.addEventListener('click', () => {
      // 打包进行中：再次点击确认 = 中止（进度文案所在按钮即取消入口）。
      if (this.batchRun !== null) {
        this.batchRun.abort()
        return
      }
      runBatch()
    })

    backdrop.appendChild(panel)
    document.body.appendChild(backdrop)
    this.panel = backdrop
    load()
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
