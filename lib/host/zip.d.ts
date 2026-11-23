/**
 * 零依赖 ZIP 打包器（STORE 方式，不压缩）。
 * 与 dsh-companion 的 core/zip.ts 同源：用于批量导出——多个对话的
 * Markdown 文件打包为 .zip 由浏览器下载。文件名以 UTF-8 编码
 * （general purpose bit 11）。
 */
export interface ZipEntry {
    name: string;
    data: Uint8Array;
}
/** 清理文件名中的非法字符，防止 ZIP 目录穿越。 */
export declare function sanitizeFileName(name: string): string;
/**
 * 构建 ZIP 文件字节流。
 *
 * 单次分配：第一遍循环完成校验、文件名清理/编码与 CRC（并把中心目录
 * 头写入暂存数组——每条目固定 46 字节，量级可忽略），累计精确总长后
 * 第二遍直接写入唯一的目标缓冲区，无 concat、无逐块拷贝的中间数组。
 * @param entries 条目列表（名称在内部统一经 sanitizeFileName 强制清理）。
 * @returns 完整的 .zip 字节。
 * @throws 条目数超过 65535，或单条目超过 4GB（不支持 ZIP64）。
 */
export declare function buildZip(entries: readonly ZipEntry[]): Uint8Array;
