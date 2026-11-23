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

import type { Context } from '@deepseek-ai/cordis'
import { buildBatchZip, enrichSessionTitles, normalizeSessionHeaders, parseSessionIds, toSafeHttpError } from './host/batch.ts'
import { createRouter, sendJson } from './host/http.ts'

/** Stable Cordis plugin name (matches the manifest id). */
export const name = '@dsh-external/dsh-conv-export'

/** 依赖服务：同源路由挂载点与会话查询（批量导出专用，只读）。 */
export const inject = ['webServer', 'sessionQuery']

/**
 * 宿主入口：注册 /conv-export 前缀路由与两个批量导出端点。
 * 全部注册经 ctx.effect，随插件卸载自动回卷；错误一律收敛为
 * HttpError，不泄漏内部细节。
 * @param ctx - host root context（经 inject 提供 webServer / sessionQuery）。
 */
export function apply(ctx: Context): void {
  const router = createRouter('/conv-export')
  ctx.effect(() => {
    const disposers: Array<() => void> = [
      ctx.webServer.register({
        kind: 'prefix',
        path: '/conv-export',
        handler: (req, res) => router.handle(req, res),
      }),

      // 会话列表（批量选择面板数据源）。
      // 真实宿主返回嵌套语料记录且头不含标题：先归一化为扁平头，再经
      // readTitleSnapshots（可选）折取标题，浏览器侧契约保持不变。
      router.add('GET', '/sessions', async (_req, res) => {
        try {
          const records = await ctx.sessionQuery.listSessions()
          const sessions = normalizeSessionHeaders(records)
          await enrichSessionTitles(ctx.sessionQuery, sessions)
          sendJson(res, 200, { sessions })
        } catch (error) {
          throw toSafeHttpError(error, '获取会话列表失败')
        }
      }),

      // 批量导出：所选会话各生成一份 Markdown，打包为 ZIP（base64）。
      router.add('POST', '/batch', async (_req, res, hctx) => {
        try {
          const sessionIds = parseSessionIds(hctx.body)
          const result = await buildBatchZip(ctx.sessionQuery, sessionIds)
          sendJson(res, 200, {
            kind: 'file',
            fileName: result.fileName,
            mimeType: 'application/zip',
            contentBase64: toBase64(result.bytes),
          })
        } catch (error) {
          throw toSafeHttpError(error, '批量导出失败')
        }
      }),
    ]
    return () => {
      for (const dispose of [...disposers].reverse()) dispose()
    }
  }, 'dsh-conv-export: host routes')
}

/** 字节内容 base64 编码（HTTP 响应中字节一律 base64）。 */
function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}
