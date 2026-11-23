/**
 * 便携档案阅读器（批量导出的创新层）。
 *
 * 批量导出的 ZIP 不再只是一堆 .md 文件：额外内嵌一个 `index.html`
 * 离线阅读器 + `manifest.json` 机器可读索引——
 * - 双击 index.html 即可浏览全部导出会话（无需服务器、无需解压工具，
 *   file:// 协议直接工作）；
 * - 内置即时全文搜索（标题 + 正文，客户端过滤，零依赖零网络）；
 * - 每个会话可在线阅读（角色徽章 + 时间戳）、一键复制 Markdown、
 *   一键下载 .md（Blob 重建，离线可用）；
 * - 明暗主题自动跟随系统。
 *
 * 纯函数生成（buildArchiveViewerHtml / buildArchiveManifest），
 * 全部数据以 JSON 嵌入单个 HTML——档案馆即文件，文件即档案馆。
 */
/** 档案阅读器消费的单会话数据（由 buildBatchZip 汇出）。 */
export interface ArchiveSessionData {
    readonly id: string;
    readonly title: string;
    readonly createdAt: number;
    readonly updatedAt?: number;
    readonly turnCount: number;
    /** 首条用户消息的摘要（不点开即知会话主题；无则空串）。 */
    readonly preview: string;
    /** 该会话的完整 Markdown 源文本（与 ZIP 内 .md 条目逐字节一致）。 */
    readonly markdown: string;
}
/** manifest.json 的机器可读索引条目。 */
export interface ArchiveManifestEntry {
    readonly id: string;
    readonly title: string;
    readonly createdAt: number;
    readonly updatedAt?: number;
    readonly turns: number;
    /** 首条用户消息的摘要（与阅读器一致，便于外部工具直接展示）。 */
    readonly preview?: string;
    /** ZIP 内对应的 Markdown 条目名。 */
    readonly file: string;
}
/** 档案全局统计（manifest.stats 与阅读器统计条共同消费）。 */
export interface ArchiveStats {
    readonly sessions: number;
    readonly turns: number;
    /** 最早创建时间（无会话时缺省）。 */
    readonly firstAt?: number;
    /** 最晚创建时间（无会话时缺省）。 */
    readonly lastAt?: number;
}
/**
 * 折取档案摘要：压缩空白并截断至 96 字符（无内容时空串）。
 * 与浏览器侧回合面板的 previewOf 同一纪律，宿主半独立实现。
 */
export declare function archivePreview(text: string): string;
/**
 * 从会话条目折取全局统计：会话数、总轮次、时间跨度。
 * 纯函数，空档案返回零值。
 */
export declare function buildArchiveStats(entries: readonly ArchiveManifestEntry[]): ArchiveStats;
/**
 * 生成 manifest.json 内容（机器可读索引：id → 文件名映射、轮次计数、
 * 每会话摘要与全局统计）。version 2：新增 stats 与 preview 字段，
 * 旧字段全部保留（纯增量，旧消费者不受影响）。
 */
export declare function buildArchiveManifest(entries: readonly ArchiveManifestEntry[], meta: {
    exportedAt: number;
}): string;
/**
 * 生成自包含离线阅读器 index.html。
 *
 * 结构：<script type="application/json"> 携带全部会话数据（含 Markdown
 * 源），内联 CSS + vanilla JS 渲染侧栏列表 / 主阅读区 / 即时搜索。
 * @param sessions 全部导出会话（含 Markdown 源文本）。
 * @param meta 导出元信息（时间戳展示用）。
 */
export declare function buildArchiveViewerHtml(sessions: readonly ArchiveSessionData[], meta: {
    exportedAt: number;
}): string;
