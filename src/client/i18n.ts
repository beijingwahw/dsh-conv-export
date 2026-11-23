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
  'menu.markdown': 'Markdown',
  'menu.html': 'HTML',
  'menu.pdf': 'PDF',
  'menu.image': '长图',
  'menu.copy': '复制 Markdown',
  'menu.select': '选择回合导出…',
  'menu.batch': '批量导出会话…',
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
  'batch.title': '批量导出会话',
  'batch.caption': '筛选并勾选历史会话，将打包为 Markdown ZIP',
  'batch.search': '按标题或会话 ID 筛选…',
  'batch.minSelect': '请至少选择一个会话',
  'batch.loading': '加载会话列表…',
  'batch.loadFail': '会话列表加载失败',
  'batch.retry': '重试',
  'batch.empty': '暂无可导出的会话',
  'batch.noMatch': '没有匹配的会话',
  'batch.packing': '正在打包…',
  'batch.done': '已导出所选会话（ZIP 压缩包）',
  'batch.fail': '批量导出失败',
  'batch.cancelled': '已取消批量导出',
  'batch.unreachable': '无法连接导出服务，请确认宿主已加载插件',
} satisfies Record<string, string>

/** Dictionary key union. */
export type ExportKey = keyof typeof zh

/** English dictionary, complete against the zh key set. */
const en: Record<ExportKey, string> = {
  'action.label': 'Export conversation',
  'action.aria': 'Export this conversation (Markdown / PDF / long image)',
  'action.hint': 'Export this conversation',
  'menu.markdown': 'Markdown',
  'menu.html': 'HTML',
  'menu.pdf': 'PDF',
  'menu.image': 'Long image',
  'menu.copy': 'Copy Markdown',
  'menu.select': 'Select turns…',
  'menu.batch': 'Batch export sessions…',
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
  'batch.title': 'Batch export sessions',
  'batch.caption': 'Filter and check sessions; they pack into a Markdown ZIP',
  'batch.search': 'Filter by title or session ID…',
  'batch.minSelect': 'Select at least one session',
  'batch.loading': 'Loading sessions…',
  'batch.loadFail': 'Failed to load sessions',
  'batch.retry': 'Retry',
  'batch.empty': 'No sessions to export',
  'batch.noMatch': 'No matching sessions',
  'batch.packing': 'Packing…',
  'batch.done': 'Exported selected sessions (ZIP archive)',
  'batch.fail': 'Batch export failed',
  'batch.cancelled': 'Batch export cancelled',
  'batch.unreachable': 'Cannot reach the export service — make sure the host has the plugin loaded',
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
