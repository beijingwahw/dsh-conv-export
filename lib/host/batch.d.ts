import { HttpError } from './http.ts';
import type { SessionListRecord, SessionQueryEngine } from './types.ts';
/** 批量导出会话数上限（去重后计数）。 */
export declare const MAX_BATCH_SESSIONS = 100;
/**
 * 批量读取并发度：真实宿主的 readSession 是持久化 IO（zstd 解压 +
 * 重放校验），串行时 100 会话约数秒。与 dsh-session-query 自身的
 * persistedInspectConcurrency（默认 4）对齐——并发读取互不依赖，
 * 输出顺序由结果槽位保证，与完成顺序无关。
 */
export declare const READ_CONCURRENCY = 4;
/** 批量导出结果（字节未 base64，HTTP 层负责编码）。 */
export interface BatchZipResult {
    fileName: string;
    bytes: Uint8Array;
    /** 读取失败被跳过的会话数。 */
    skipped: number;
}
/**
 * 解析 POST /conv-export/batch 的请求体 sessionIds 字段。
 * @throws 形状不符（非对象 / 非数组 / 空数组 / 含非字符串项）→ 400。
 */
export declare function parseSessionIds(body: unknown): string[];
/** 可变会话头（归一化产物；标题补全阶段就地写入）。 */
type MutableSessionHeader = {
    id: string;
    title?: string;
    createdAt: number;
    updatedAt?: number;
};
/**
 * 将 listSessions 的原始返回归一化为扁平会话头（浏览器面板契约）。
 *
 * 兼容两种上游形状：扁平头（dev 桩 / 旧适配层）与真实宿主的嵌套记录
 * `{ header, live, persisted }`；形状不合法的条目静默跳过（防御性，
 * 不让个别坏记录拖垮整个列表）。
 */
export declare function normalizeSessionHeaders(records: readonly SessionListRecord[]): MutableSessionHeader[];
/**
 * 尽力而为的标题补全：真实宿主的标题在日志 `session/title` 事件里，
 * listSessions 的头不含标题。服务提供 readTitleSnapshots 时按输入
 * 顺序折取标题写入对应会话头；任何失败静默忽略（标题缺失可降级，
 * 列表本身不受影响）。
 */
export declare function enrichSessionTitles(sessionQuery: SessionQueryEngine, sessions: MutableSessionHeader[]): Promise<void>;
/**
 * 批量导出多个会话并打包为 Markdown ZIP。
 * @param sessionQuery 会话查询服务（对宿主的唯一依赖）。
 * @param sessionIds 会话 id 列表：先经 Set 去重，去重后数量不得超过
 * MAX_BATCH_SESSIONS；单个会话读取失败会被跳过并计入 skipped，
 * 系统性错误（ZIP 组装等）上抛。
 */
export declare function buildBatchZip(sessionQuery: SessionQueryEngine, sessionIds: readonly string[]): Promise<BatchZipResult>;
/**
 * 将错误收敛为用户安全的 HttpError：
 * HttpError 原样透传；其余错误以通用文案包装，避免泄漏内部细节。
 */
export declare function toSafeHttpError(error: unknown, fallbackMessage: string): HttpError;
export {};
