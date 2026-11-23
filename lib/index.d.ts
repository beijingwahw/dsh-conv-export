/**
 * dsh-conv-export 宿主入口：批量导出的只读服务层。
 *
 * 历史上这里是空注册壳（全部行为位于浏览器 bundle）；批量导出需要跨
 * 会话读取历史对话——浏览器侧无法访问当前会话之外的转录——故宿主半
 * 新增一个瘦服务层：经 ctx.webServer 挂载 /conv-export 前缀路由，经
 * ctx.sessionQuery 读取会话。无存储域、无出站网络请求、无状态；
 * 单会话导出（Markdown / PDF / 长图）与回合选择仍完全在浏览器
 * bundle（exports["./client"]）内，不经此路径。
 *
 * 端点（全部 JSON，字节内容 base64）：
 * - GET  /conv-export/sessions → { sessions: SessionHeader[] }
 * - POST /conv-export/batch    { sessionIds: string[] }
 *   → { kind: 'file', fileName, mimeType: 'application/zip', contentBase64 }
 */
import type { Context } from '@deepseek-ai/cordis';
/** Stable Cordis plugin name (matches the manifest id). */
export declare const name = "@dsh-external/dsh-conv-export";
/** 依赖服务：同源路由挂载点与会话查询（批量导出专用，只读）。 */
export declare const inject: string[];
/**
 * 宿主入口：注册 /conv-export 前缀路由与两个批量导出端点。
 * 全部注册经 ctx.effect，随插件卸载自动回卷；错误一律收敛为
 * HttpError，不泄漏内部细节。
 * @param ctx - host root context（经 inject 提供 webServer / sessionQuery）。
 */
export declare function apply(ctx: Context): void;
