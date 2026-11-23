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
    'menu.markdown': string;
    'menu.html': string;
    'menu.pdf': string;
    'menu.image': string;
    'menu.copy': string;
    'menu.select': string;
    'menu.batch': string;
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
    'batch.title': string;
    'batch.caption': string;
    'batch.search': string;
    'batch.minSelect': string;
    'batch.loading': string;
    'batch.loadFail': string;
    'batch.retry': string;
    'batch.empty': string;
    'batch.noMatch': string;
    'batch.packing': string;
    'batch.done': string;
    'batch.fail': string;
    'batch.cancelled': string;
    'batch.unreachable': string;
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
