/**
 * 插件私有 HTTP 路由器（/conv-export 前缀）。
 *
 * 形状与 dsh-companion 的 core/http.ts 同源：前缀安全匹配（防止
 * /conv-export-x 被误匹配）、JSON 请求体读取（8MB 上限 + 30s 超时 +
 * 提前断开检测）、错误响应兜底销毁连接，杜绝未处理 rejection。
 * 浏览器侧客户端（src/client/batch.ts）经同源 fetch 调用这些端点。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
export interface HttpRequestContext {
    query: URLSearchParams;
    /** POST/DELETE 请求的 JSON 正文（GET 为 undefined）。 */
    body: unknown;
}
export type HttpHandler = (req: IncomingMessage, res: ServerResponse, ctx: HttpRequestContext) => void | Promise<void>;
/** 带状态码的业务错误。 */
export declare class HttpError extends Error {
    readonly status: number;
    constructor(message: string, status?: number);
}
export interface HostRouter {
    /** 挂载端点；返回注销 disposer。重复 (method, path) 抛错。 */
    add(method: 'GET' | 'POST' | 'DELETE', path: string, handler: HttpHandler): () => void;
    /** 由 webServer 前缀路由委派的统一入口。 */
    handle(req: IncomingMessage, res: ServerResponse): Promise<void>;
}
/**
 * 创建路由器。
 * @param basePath 前缀路径（默认 /conv-export）。
 */
export declare function createRouter(basePath?: string): HostRouter;
/** 发送 JSON 响应。 */
export declare function sendJson(res: ServerResponse, status: number, payload: unknown): void;
/**
 * 读取并解析 JSON 请求体（大小上限默认 8 MB；空正文返回 {}）。
 * @param req 请求对象。
 * @param limitBytes 大小上限（字节）。
 * @param timeoutMs 读取超时（默认 30 秒）：慢速/停滞的 body 不会无限挂起，超时抛 408。
 */
export declare function readJsonBody(req: IncomingMessage, limitBytes?: number, timeoutMs?: number): Promise<unknown>;
