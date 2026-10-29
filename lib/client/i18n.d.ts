/**
 * Tiny self-contained i18n for the export menu. The menu renders outside the
 * slot render tree (fixed overlay), so it carries its own dictionaries and
 * picks the language from the document/navigator instead of the locale
 * service — zero extra service dependencies.
 */
/** Simplified Chinese dictionary (key-set source of truth). */
declare const zh: {
    'action.label': string;
    'action.aria': string;
    'action.hint': string;
    'turn.hint': string;
    'turn.aria': string;
    'turn.suffix': string;
    'menu.markdown': string;
    'menu.html': string;
    'menu.pdf': string;
    'menu.image': string;
    'menu.copy': string;
    'menu.select': string;
    'role.user': string;
    'role.assistant': string;
    'toast.imageFail': string;
    'toast.exportFail': string;
    'toast.copyDone': string;
    'toast.copyFail': string;
    'toast.cancelled': string;
    'panel.title': string;
    'panel.caption': string;
    'panel.close': string;
    'panel.selectAll': string;
    'panel.selectNone': string;
    'panel.selected': string;
    'panel.format': string;
    'panel.export': string;
    'panel.cancel': string;
    'panel.empty': string;
};
/** Dictionary key union. */
export type ExportKey = keyof typeof zh;
/**
 * Translate one key.
 * @param key - dictionary key.
 * @returns the localized text.
 */
export declare function t(key: ExportKey): string;
export {};
