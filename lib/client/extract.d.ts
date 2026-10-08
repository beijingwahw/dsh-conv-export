/**
 * Conversation extraction: walks the rendered transcript and produces a
 * role-ordered message list the exporters (Markdown / PDF / long image)
 * share.
 *
 * Selectors come from the stock web app's rendered DOM (verified against a
 * live session): user turns hang under a row whose CSS-module class ends in
 * `_userRow` (bubble text inside `[class*="_bubble"]`); assistant turns are
 * rendered markdown under `[class*="_markdown_"]`. Class names are
 * hash-prefixed (`gdEzaW_userRow`), so attribute-contains matching is the
 * stable contract.
 *
 * No cordis, no React — pure DOM helpers, unit-testable against jsdom.
 */
/** Selector of the conversation scrollport the extractor operates within. */
export declare const SCROLL_SELECTOR = "[data-conversation-scroll]";
/** Selector matching a user turn row. */
export declare const USER_ROW_SELECTOR = "[class*=\"_userRow\"]";
/** Selector matching the user bubble inside the row. */
export declare const USER_BUBBLE_SELECTOR = "[class*=\"_bubble\"]";
/** Selector matching an assistant turn's rendered markdown container. */
export declare const ASSISTANT_MD_SELECTOR = "[class*=\"_markdown_\"]";
/** Selector of the header breadcrumb segment carrying the session title. */
export declare const TITLE_SELECTOR = "[class*=\"crumbSeg\"]";
/** One extracted turn of the conversation. */
export interface ExtractedMessage {
    /** Who produced the turn. */
    readonly role: 'user' | 'assistant';
    /** Plain text (user turns) — the bubble's visible text. */
    readonly text: string;
    /** Rendered HTML (assistant turns) — the markdown container's innerHTML. */
    readonly html: string;
}
/**
 * Resolve the conversation scrollport from anywhere in the document.
 * @param from - any element or the document itself.
 * @returns the scrollport element, or null when no conversation is rendered.
 */
export declare function resolveScope(from?: ParentNode): HTMLElement | null;
/**
 * Read the session title from the header breadcrumb.
 * @returns the trimmed title, or null when absent.
 */
export declare function readTitle(): string | null;
/**
 * Extract every rendered turn in document order. User rows and assistant
 * markdown containers are collected with one combined querySelectorAll,
 * which returns document order — so the interleaving is exactly what the
 * reader sees.
 * @param scope - the conversation scrollport (defaults to resolving one).
 * @returns the ordered turns; empty when nothing is rendered.
 */
export declare function extractMessages(scope?: HTMLElement | null): ExtractedMessage[];
/**
 * Build one user turn from its row node (bubble text, falling back to the
 * whole row when the bubble class is absent).
 * @param node - the `_userRow` element.
 * @returns the turn, or null when the row renders no text (empty shell).
 */
export declare function fromUserRow(node: HTMLElement): ExtractedMessage | null;
/**
 * Build one assistant turn from its markdown container (skip empty shells —
 * still-streaming placeholders render no text yet).
 * @param node - the `_markdown_` element.
 * @returns the turn, or null when the container renders no text.
 */
export declare function fromMarkdownNode(node: HTMLElement): ExtractedMessage | null;
/** Class shared by every per-turn export button (strip entry + CSS hooks). */
export declare const TURN_BUTTON_CLASS = "dsh-conv-export-turn";
/** Per-turn extraction result (the assistant-actions strip's export entry). */
export interface TurnExtract {
    /** The turn's segment (user question when adjacent + the reply), document order. */
    readonly messages: readonly ExtractedMessage[];
    /** 1-based ordinal among every assistant markdown container in the pane; 0 = unknown. */
    readonly index: number;
}
/**
 * Extract the single turn that owns `anchor` — the per-turn export button
 * rendered into `conversation.chat.assistant-actions`.
 *
 * The strip does NOT reliably sit inside the reply's own wrapper, so ancestry
 * is only a hint; resolution therefore layers three independent probes:
 *
 * 1. **messageId seat** — the slot hands us the assistant message id; the
 *    pane keys its chat-node seats by message key, so a seat containing that
 *    id pins the body exactly.
 * 2. **button ordinal** — the plugin renders one button per finalized reply,
 *    so with `buttons.length === bodies.length` the Nth button maps to the
 *    Nth body. Correct even when every strip shares one container (the layout
 *    that made ancestry return the first reply for every button).
 * 3. **document order** — the body immediately preceding the strip (strips
 *    render under their reply); falls forward when a strip renders above it.
 *
 * The user question directly preceding the chosen body joins the segment, so
 * "this turn" exports ask + answer.
 *
 * @param anchor - the per-turn export button.
 * @param messageId - slot-provided assistant message id (may be undefined).
 * @returns the turn payload, or null when no rendered body is reachable.
 */
export declare function extractTurn(anchor: Element, messageId?: string): TurnExtract | null;
/**
 * Sanitize a string into a safe download-file stem: path/hostile characters
 * and runs of whitespace collapse to '-', capped at 60 chars.
 * @param raw - the proposed file name stem (e.g. the session title).
 * @returns the sanitized stem (never empty).
 */
export declare function safeFileStem(raw: string): string;
