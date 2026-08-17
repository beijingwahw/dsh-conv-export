/**
 * 开发期聚合入口（仅 `npm run dev` 的独立 cordis 进程使用，不参与构建产物）。
 *
 * 宿主壳 src/index.ts 是空注册壳（不 import 任何文件），单独挂载它时
 * src/invariant.ts 不在 ESM linked 依赖图内，修改不会触发热重载。
 * 本聚合入口把两者纳入同一依赖图：改 index.ts / invariant.ts 均触发 HMR。
 * src/client/** 为浏览器 bundle（react/DOM），不进 node 进程。
 */
export { name, apply } from '../src/index.ts'
import '../src/invariant.ts'
