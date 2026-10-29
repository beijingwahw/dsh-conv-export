/**
 * dsh-conv-export 宿主入口（本 fork：批量导出已整体移除）。
 *
 * 上游版本在这里经 ctx.webServer 挂载 /conv-export 前缀路由、经
 * ctx.sessionQuery 读取历史会话，用于跨会话批量打包。本 fork 的取舍：
 *
 * 1. 无鉴权面：DSH webServer 文档明确「服务端不做 TLS / 鉴权 / origin
 *    策略，路由所有者自己负责」，而该端点未加任何一层——实测不带 token
 *    即可 GET 会话列表、POST 拉走任意会话全文 ZIP（对照 /api/* 一律 401）。
 * 2. 性能：列表接口每次全量读日志折标题，实测 18 秒以上且无缓存。
 * 3. 泄露：批量 Markdown 由日志派生，会把 <system-reminder> 与
 *    AGENTS.md 全文一并导出。
 *
 * 因此宿主半整体删除：无 webServer / sessionQuery 依赖、无出站请求、
 * 无状态。插件只剩浏览器半——单会话与单轮导出，全部在点击时刻从渲染
 * DOM 提取（所见即所得，天然不含思考块、工具卡片与注入的指令层）。
 *
 * 注意：cordis.patch.yml 里的 insert 行必须保留——boot graph 靠它扫描
 * 包的 `dsh.client` 声明，才会在 /plugins/<id>/client.js 提供浏览器
 * bundle；它与宿主是否注册路由无关。
 */

import type { Context } from '@deepseek-ai/cordis'

/** Stable Cordis plugin name (matches the manifest id). */
export const name = '@dsh-external/dsh-conv-export'

/**
 * 宿主入口：空壳。全部导出行为位于浏览器 bundle（exports["./client"]）。
 * @param _ctx - host root context（不使用任何服务）。
 */
export function apply(_ctx: Context): void {
  // Intentionally empty — see the module comment for why batch export left.
}
