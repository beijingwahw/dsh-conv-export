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
  'turn.hint': '导出这一轮对话',
  'turn.aria': '导出这一轮对话 (Markdown / HTML / PDF / 长图)',
  'turn.suffix': '回合',
  'menu.markdown': 'Markdown',
  'menu.html': 'HTML',
  'menu.pdf': 'PDF',
  'menu.image': '长图',
  'menu.copy': '复制 Markdown',
  'menu.select': '选择回合导出…',
  'role.user': '用户',
  'role.assistant': '助手',
  'toast.imageFail': '长图生成失败，请改用 Markdown 或 PDF',
  'toast.exportFail': '导出失败，请重试',
  'toast.copyDone': '已复制 Markdown 到剪贴板',
  'toast.copyFail': '复制失败，请改用 Markdown 下载',
  'toast.cancelled': '导出已取消',
  'panel.title': '选择要导出的对话回合',
  'panel.caption': '勾选要保留的回合，再挑选导出格式',
  'panel.close': '关闭',
  'panel.selectAll': '全选',
  'panel.selectNone': '全不选',
  'panel.selected': '已选',
  'panel.format': '格式',
  'panel.export': '导出',
  'panel.cancel': '取消',
  'panel.empty': '请至少选择一个回合',
} satisfies Record<string, string>

/** Dictionary key union. */
export type ExportKey = keyof typeof zh

/** English dictionary, complete against the zh key set. */
const en: Record<ExportKey, string> = {
  'action.label': 'Export conversation',
  'action.aria': 'Export this conversation (Markdown / PDF / long image)',
  'action.hint': 'Export this conversation',
  'turn.hint': 'Export this turn',
  'turn.aria': 'Export this turn (Markdown / HTML / PDF / long image)',
  'turn.suffix': 'turn',
  'menu.markdown': 'Markdown',
  'menu.html': 'HTML',
  'menu.pdf': 'PDF',
  'menu.image': 'Long image',
  'menu.copy': 'Copy Markdown',
  'menu.select': 'Select turns…',
  'role.user': 'User',
  'role.assistant': 'Assistant',
  'toast.imageFail': 'Long-image render failed — use Markdown or PDF instead',
  'toast.exportFail': 'Export failed — try again',
  'toast.copyDone': 'Markdown copied to clipboard',
  'toast.copyFail': 'Copy failed — use the Markdown download instead',
  'toast.cancelled': 'Export cancelled',
  'panel.title': 'Select turns to export',
  'panel.caption': 'Check the turns to keep, then pick a format',
  'panel.close': 'Close',
  'panel.selectAll': 'All',
  'panel.selectNone': 'None',
  'panel.selected': 'Selected',
  'panel.format': 'Format',
  'panel.export': 'Export',
  'panel.cancel': 'Cancel',
  'panel.empty': 'Select at least one turn',
}

/**
 * Resolve the live language source for the current document.
 *
 * 早期版本在第一次 `t()` 时把字典缓存死，而插件 `apply` 早于 locale 插件把
 * `<html lang>` 写成 `zh-CN`（静态 index.html 声明的是产品默认 `en`），
 * 于是菜单与导出文档被永久钉在英文。这里每次按当前 lang 判定、只缓存源串：
 * 语言切换立刻跟随，且没有重复解析开销。另外，`en` 是未被 locale 插件
 * 触碰过的产品默认值，此时让浏览器语言兜底（中文系统 → 中文界面）。
 * @returns the language source to key the dictionary on.
 */
function liveSource(): string {
  const doc = (document.documentElement.lang || '').toLowerCase()
  const nav = (navigator.language || navigator.languages?.[0] || '').toLowerCase()
  if (doc !== '') return doc === 'en' && nav.startsWith('zh') ? nav : doc
  return nav.startsWith('zh') ? nav : nav === '' ? 'en' : nav
}

/** Last observed language source ("" = not resolved yet). */
let cachedSource = ''

/** Dictionary for {@link cachedSource}. */
let active: Record<ExportKey, string> = zh

/**
 * Translate one key.
 * @param key - dictionary key.
 * @returns the localized text.
 */
export function t(key: ExportKey): string {
  const source = liveSource()
  if (source !== cachedSource) {
    cachedSource = source
    active = source.startsWith('zh') ? zh : en
  }
  return active[key]
}
