/** 会话头信息（GET /sessions 的返回项）。 */
export interface BatchSession {
    readonly id: string;
    readonly title?: string;
    readonly createdAt: number;
    readonly updatedAt?: number;
}
/** 列出可批量导出的会话（批量选择面板数据源）。 */
export declare function fetchBatchSessions(signal?: AbortSignal): Promise<readonly BatchSession[]>;
/** 批量导出选中会话为 Markdown ZIP 并触发浏览器下载。 */
export declare function runBatchExport(sessionIds: readonly string[], signal?: AbortSignal): Promise<void>;
