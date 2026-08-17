/**
 * Rendered-HTML → Markdown serialization for assistant turns, plus the
 * document assembler shared by the Markdown and PDF exporters.
 *
 * The assistant transcript is React-rendered markdown (headings, lists,
 * code fences, tables, inline emphasis). Exporting it as Markdown requires
 * walking that DOM back into source form. This serializer covers the stock
 * renderer's element set; unknown elements degrade to their children, so
 * content is never dropped — only formatting may flatten.
 *
 * No cordis, no React — pure DOM helpers, unit-testable against jsdom.
 */
import type { ExtractedMessage } from './extract.ts';
/**
 * Convert one assistant turn's rendered HTML back into markdown.
 * @param html - the markdown container's innerHTML.
 * @returns the serialized markdown (trimmed).
 */
export declare function htmlToMarkdown(html: string): string;
/**
 * Assemble the full export document.
 * @param title - the session title (null → generic heading).
 * @param messages - the extracted turns, in order.
 * @returns the markdown document text.
 */
export declare function buildMarkdown(title: string | null, messages: readonly ExtractedMessage[]): string;
