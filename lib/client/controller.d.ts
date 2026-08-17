/**
 * The singleton controller. A page hosts exactly one conversation pane, so
 * a module-level instance is the right ownership; cordis install/uninstall
 * bracket its DOM effects.
 */
declare class ExportController {
    private menu;
    private installed;
    private busy;
    /** Install the menu DOM and document listeners. Idempotent. */
    install(): void;
    /** Remove every installed effect. Idempotent. */
    uninstall(): void;
    /**
     * Toggle the dropdown (the header action button's gesture), anchoring it
     * under the triggering button.
     * @param anchor - the header action button (positions the menu).
     */
    toggle(anchor?: Element): void;
    /** Close the dropdown. */
    close(): void;
    /** Build the dropdown once and hide it until opened. */
    private mountMenu;
    /** Mirror the open state onto the header action button. */
    private syncActionButton;
    /** Close on any pointer-down outside the menu and its action button. */
    private readonly onOutside;
    /** Escape closes the menu. */
    private readonly onKeyDown;
    /**
     * Run one export sink against the currently rendered transcript.
     * @param kind - which sink to run.
     */
    private run;
    /**
     * Show a transient toast (bottom-center) for export failures.
     * @param text - the message to show.
     */
    private toast;
}
/** The page-wide controller instance. */
export declare const controller: ExportController;
export {};
