/**
 * 开发期宿主服务桩（仅 `npm run dev` 的独立 cordis 进程使用，不参与构建产物）。
 *
 * 宿主入口（src/index.ts）inject: webServer / sessionQuery；独立 cordis
 * 进程没有 dsh 宿主，缺桩时 fiber 永远 PENDING。各桩按插件实际消费的
 * 最小面给出：
 * - webServer.register({kind,path,handler}) → 返回函数型 disposer（经 ctx.effect 回卷）
 * - sessionQuery → 空会话列表；readSession 显式抛错（端点真正被调用时才触及）
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'conv-export-host-stubs'

export function apply(ctx: Context): void {
  ctx.provide('webServer', {
    register: (_def: unknown) => () => {},
  })

  ctx.provide('sessionQuery', {
    listSessions: async () => [],
    readSession: async (id: string) => {
      throw new Error(`[dev-stub] sessionQuery.readSession(${id})：开发桩无会话数据`)
    },
  })
}
