/**
 * 宿主批量导出 API 的类型化 fetch 封装（同源 /conv-export 前缀，
 * 端点契约见 src/index.ts）。
 *
 * - 非 2xx 响应统一携带 `{ error: string }`，在此解析为本地 Error；
 * - 字节内容以 base64 传输，解码为 Blob 后经 downloadBlob 触发下载；
 * - 全部请求接受 AbortSignal（面板关闭 / 取消时中止在途请求）；
 * - 不导入宿主代码（src/host/**），仅依赖浏览器内置能力。
 */
import { downloadBlob } from './exporters.ts'
import { t } from './i18n.ts'

/** 私有 API 统一前缀（同源请求）。 */
const API_PREFIX = '/conv-export'

/** 会话头信息（GET /sessions 的返回项）。 */
export interface BatchSession {
  readonly id: string
  readonly title?: string
  readonly createdAt: number
  readonly updatedAt?: number
}

/** POST /batch 的响应（ZIP 文件载荷）。 */
interface BatchRunResponse {
  readonly fileName: string
  readonly mimeType: string
  readonly contentBase64: string
}

/** 中止类错误判定（fetch 中止统一为 DOMException AbortError，原样透传）。 */
function isAbortError(error: unknown): error is DOMException {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** 收窄服务端错误体（契约：非 2xx 一律 `{ error: string }`）。 */
function extractErrorMessage(payload: unknown, status: number): string {
  if (typeof payload === 'object' && payload !== null) {
    const error = (payload as Record<string, unknown>).error
    if (typeof error === 'string' && error.length > 0) return error
  }
  return `请求失败（HTTP ${status}）`
}

/** 统一请求：解析 JSON、非 2xx 抛错；网络层失败归一化为可读文案。 */
async function request<T>(path: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    // 条件展开：exactOptionalPropertyTypes 下不显式写入 signal: undefined。
    response = await fetch(`${API_PREFIX}${path}`, signal === undefined ? init : { ...init, signal })
  } catch (error) {
    if (isAbortError(error)) throw error
    // 网络层失败：宿主未加载插件（无 /conv-export 路由）或服务不可达。
    throw new Error(t('batch.unreachable'))
  }
  const text = await response.text()
  let payload: unknown = {}
  try {
    payload = text.length > 0 ? JSON.parse(text) : {}
  } catch {
    throw new Error(extractErrorMessage(undefined, response.status))
  }
  if (!response.ok) throw new Error(extractErrorMessage(payload, response.status))
  return payload as T
}

/** 列出可批量导出的会话（批量选择面板数据源）。 */
export async function fetchBatchSessions(signal?: AbortSignal): Promise<readonly BatchSession[]> {
  const payload = await request<{ sessions: readonly BatchSession[] }>('/sessions', {}, signal)
  return payload.sessions
}

/** 批量导出选中会话为 Markdown ZIP 并触发浏览器下载。 */
export async function runBatchExport(
  sessionIds: readonly string[],
  signal?: AbortSignal,
): Promise<void> {
  const payload = await request<BatchRunResponse>(
    '/batch',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIds }),
    },
    signal,
  )
  downloadBlob(payload.fileName, payload.mimeType, base64ToBlob(payload.contentBase64, payload.mimeType))
}

/** base64 → Blob（二进制安全：逐字节填充，不经 atob→字符串 的 Latin-1 陷阱）。 */
function base64ToBlob(b64: string, mime: string): Blob {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
