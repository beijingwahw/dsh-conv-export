/**
 * dsh-conv-export browser half: export the current conversation as
 * Markdown, PDF, or a long PNG image — from the session header, or from a
 * single assistant turn's own strip button.
 *
 * Two contributions:
 * 1. an export icon button in the session header's action row, registered
 *    into `conversation.session.header.actions` (the additive seat for
 *    per-session controls beside the title);
 * 2. a per-turn export button in `conversation.chat.assistant-actions` —
 *    the IconActions strip under every finalized assistant reply — which
 *    opens the same dropdown scoped to that turn only.
 *
 * Zero core changes: everything rides cordis effects and declared slots.
 */
import { type ReactElement } from 'react';
/** Stable Cordis plugin name (matches the manifest id). */
export declare const name = "@dsh-external/dsh-conv-export";
/** Required services: the slot registry (both seats ride it). */
export declare const inject: string[];
/** The two slot keys this plugin contributes to. */
type SlotKey = 'conversation.session.header.actions' | 'conversation.chat.assistant-actions';
/**
 * Minimal structural face of the slot service this plugin uses. Declared
 * locally (not imported) so the client bundle stays pure: cross-package
 * value imports are forbidden, and the only runtime dependency is the slot
 * service shape every stock web app provides.
 */
interface SlotsFace {
    inject(key: SlotKey, callback: () => () => void): () => void;
    register(options: {
        name: SlotKey;
        id: string;
        order: number;
        inject: () => Record<string, never>;
    }, component: (props: SlotProps) => ReactElement | null): () => void;
}
/** Minimal client context face (the slot service is the only dependency). */
interface ClientContextFace {
    slots: SlotsFace;
    effect(effect: () => (() => void) | void, label?: string): () => Promise<void>;
}
/**
 * Slot props: the header kit carries `sessionId`; the assistant-actions strip
 * carries `messageId`, which pins the exact reply during extraction.
 */
interface SlotProps {
    readonly sessionId?: string;
    readonly messageId?: string;
}
/**
 * Browser plugin body: install the controller's document effects and
 * register both export buttons into their slots.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContextFace): void;
export {};
