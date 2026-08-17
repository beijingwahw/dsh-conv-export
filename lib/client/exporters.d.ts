/**
 * The three export sinks: Markdown download, PDF download, and a long PNG
 * rasterized through SVG foreignObject. All share the extracted turn list;
 * none touches the live transcript DOM.
 *
 * The PDF path never opens a print window: `window.print()` is a
 * window-modal dialog on several platforms (notably Windows Chrome) that
 * freezes the whole browser — including the app tab — until dismissed.
 * Instead the conversation is rasterized once, sliced into page-height
 * strips, JPEG-encoded, and wrapped into a minimal multi-page PDF that is
 * downloaded like any other file. Zero dialogs, zero freeze.
 *
 * No cordis, no React — pure DOM/canvas helpers, unit-testable against
 * jsdom (the raster paths degrade gracefully where canvas is unavailable).
 */
import type { ExtractedMessage } from './extract.ts';
/**
 * Trigger a client-side file download.
 * @param filename - the download file name.
 * @param mime - the blob MIME type.
 * @param data - the blob body.
 */
export declare function downloadBlob(filename: string, mime: string, data: BlobPart): void;
/**
 * Build the export body HTML (shared by the PDF pages and the long image).
 * @param title - the session title.
 * @param messages - the extracted turns.
 * @returns the body markup string.
 */
export declare function buildExportHtml(title: string, messages: readonly ExtractedMessage[]): string;
/** One PDF page's image payload. */
interface PdfPage {
    /** JPEG bytes (DCTDecode). */
    readonly jpeg: Uint8Array;
    /** Logical width in CSS px. */
    readonly widthPx: number;
    /** Logical height in CSS px. */
    readonly heightPx: number;
}
/**
 * Assemble a minimal multi-page PDF, one JPEG per page.
 * @param pages - the page payloads in order.
 * @returns the PDF file bytes.
 */
export declare function buildPdf(pages: readonly PdfPage[]): Uint8Array<ArrayBuffer>;
/**
 * Export as PDF: rasterize the conversation, slice it into page-height
 * strips, and download a self-contained multi-page PDF. No print dialog —
 * the app tab never freezes.
 * @param title - the session title (also the file stem, sanitized).
 * @param messages - the extracted turns.
 * @throws when the runtime cannot rasterize.
 */
export declare function exportPdf(title: string, messages: readonly ExtractedMessage[]): Promise<void>;
/**
 * Export as a long PNG: rasterize the whole conversation and download one
 * tall image.
 * @param title - the session title (also the file stem, sanitized).
 * @param messages - the extracted turns.
 * @throws when the runtime cannot rasterize (no canvas / SVG parse failure).
 */
export declare function exportImage(title: string, messages: readonly ExtractedMessage[]): Promise<void>;
export {};
