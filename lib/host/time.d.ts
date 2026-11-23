/**
 * 北京时间（UTC+8，无夏令时）工具（与 dsh-companion 的 core/time.ts
 * 同源，仅保留批量导出所需的最小面）。批量 ZIP 文件名与 Markdown
 * 元信息头的时间戳都以北京时间为准，与宿主机时区无关（CI/容器友好）。
 */
/** 北京时间日期键 YYYY-MM-DD。 */
export declare function beijingDayKey(ts: number): string;
/** 北京时间格式化 YYYY-MM-DD HH:mm:ss。 */
export declare function formatBeijingTime(ts: number): string;
