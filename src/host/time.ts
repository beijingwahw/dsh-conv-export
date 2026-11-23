/**
 * 北京时间（UTC+8，无夏令时）工具（与 dsh-companion 的 core/time.ts
 * 同源，仅保留批量导出所需的最小面）。批量 ZIP 文件名与 Markdown
 * 元信息头的时间戳都以北京时间为准，与宿主机时区无关（CI/容器友好）。
 */

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

/** 北京时间日期键 YYYY-MM-DD。 */
export function beijingDayKey(ts: number): string {
  const d = new Date(ts + BEIJING_OFFSET_MS)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/** 北京时间格式化 YYYY-MM-DD HH:mm:ss。 */
export function formatBeijingTime(ts: number): string {
  const d = new Date(ts + BEIJING_OFFSET_MS)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
    + ` ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}
