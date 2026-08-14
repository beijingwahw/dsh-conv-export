/**
 * Tiny self-contained i18n for the export menu. The menu renders outside the
 * slot render tree (fixed overlay), so it carries its own dictionaries and
 * picks the language from the document/navigator instead of the locale
 * service — zero extra service dependencies.
 */

/** Simplified Chinese dictionary (key-set source of truth). */
const zh = {
  'action.label': '对话导出',
  'action.aria': '导出当前对话 (Markdown / PDF / 长图)',
  'action.hint': '导出当前对话',
  'menu.markdown': 'Markdown (.md)',
  'menu.pdf': 'PDF (打印)',
  'menu.image': '长图 (PNG)',
  'meta.exported': '由 dsh-conv-export 导出于',
  'role.user': '用户',
  'role.assistant': '助手',
  'toast.imageFail': '长图生成失败，请改用 Markdown 或 PDF',
} satisfies Record<string, string>

/** Dictionary key union. */
export type ExportKey = keyof typeof zh

/** English dictionary, complete against the zh key set. */
const en: Record<ExportKey, string> = {
  'action.label': 'Export conversation',
  'action.aria': 'Export this conversation (Markdown / PDF / long image)',
  'action.hint': 'Export this conversation',
  'menu.markdown': 'Markdown (.md)',
  'menu.pdf': 'PDF (print)',
  'menu.image': 'Long image (PNG)',
  'meta.exported': 'Exported by dsh-conv-export on',
  'role.user': 'User',
  'role.assistant': 'Assistant',
  'toast.imageFail': 'Long-image render failed — use Markdown or PDF instead',
}

/**
 * Detect the UI language once: the document lang attribute wins, then the
 * navigator; anything Chinese-prefixed maps to zh, everything else to en.
 * @returns the active dictionary.
 */
function detectDict(): Record<ExportKey, string> {
  const lang = (document.documentElement.lang || navigator.language || 'en').toLowerCase()
  return lang.startsWith('zh') ? zh : en
}

let active: Record<ExportKey, string> | undefined

/**
 * Translate one key.
 * @param key - dictionary key.
 * @returns the localized text.
 */
export function t(key: ExportKey): string {
  active ??= detectDict()
  return active[key]
}
