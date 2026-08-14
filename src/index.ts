/**
 * dsh-conv-export host half: no server-side behavior — the export menu,
 * Markdown builder, print window, and long-image rasterizer live entirely in
 * the browser bundle (exports["./client"]). The host half exists so the
 * manifest has a node entry and a home for the invariant companion; keep it
 * a registration shell.
 */

/** Minimal structural face of the cordis root context this shell receives. */
interface HostContext {
  readonly [key: string]: unknown
}

/** Stable Cordis plugin name (matches the manifest id). */
export const name = '@dsh-external/dsh-conv-export'

/**
 * Browser-only behavior; the host half is an empty registration shell.
 * @param _ctx - host root context (unused).
 */
export function apply(_ctx: HostContext): void {}
