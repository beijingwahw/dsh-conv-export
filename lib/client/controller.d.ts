import type { ExtractedMessage } from './extract.ts';
/**
 * 回合预览文案：压缩空白并截断至 80 字符（选择面板条目）。
 * 纯函数，导出仅为单测。
 * @param message - 抽取出的对话回合。
 */
export declare function previewOf(message: ExtractedMessage): string;
/**
 * The singleton controller. A page hosts exactly one conversation pane, so
 * a module-level instance is the right ownership; cordis install/uninstall
 * bracket its DOM effects.
 */
declare class ExportController {
    private menu;
    /** 选择面板（backdrop 元素）；null = 未打开。 */
    private panel;
    private installed;
    private running;
    /** 打开当前菜单的触发按钮（头部按钮或每轮按钮）：aria-pressed 镜像目标。 */
    private trigger;
    /** 单轮模式：非 null 期间菜单只导出这一轮（文件名追加「-回合N」）。 */
    private turn;
    /** Install the menu DOM and document listeners. Idempotent. */
    install(): void;
    /** Remove every installed effect. Idempotent. */
    uninstall(): void;
    /**
     * Toggle the dropdown (header button **or** per-turn strip button),
     * anchoring it under the triggering element. 选择面板打开时不弹菜单。
     * 打开时按触发器判定模式：每轮按钮 → 单轮提取（messageId 用于精确定位）；
     * 头部按钮 → 全会话。
     * @param anchor - the button that owns the menu (positions it).
     * @param messageId - slot-provided assistant message id (per-turn only).
     */
    toggle(anchor?: Element, messageId?: string): void;
    /** Close the dropdown. */
    close(): void;
    /** Build the dropdown once and hide it until opened. */
    private mountMenu;
    /** Mirror the open state onto the button that opened the menu. */
    private syncActionButton;
    /** Close on any pointer-down outside the menu and its trigger button. */
    private readonly onOutside;
    /** Escape closes the menu / the idle selection panel. */
    private readonly onKeyDown;
    /** 菜单基础标签文案（进度显示复用）。 */
    private menuLabel;
    /**
     * Run one export sink against the currently rendered transcript.
     * 光栅导出进行中时，再次点击同一菜单项触发取消。
     * @param kind - which sink to run.
     */
    private run;
    /**
     * 执行一次导出（菜单全量与面板筛选共用）：进度写入宿主元素
     * 「基础标签 done/total」，完成后复位；取消以 AbortError 落入已取消提示。
     * @param kind - 导出汇。
     * @param messages - 导出的回合列表（面板路径为筛选后的子集）。
     * @param progress - 进度宿主（可缺省）。
     * @param stemSuffix - 文件名追加段（单轮导出为「-回合N / -turnN」，随界面语言）。
     */
    private execute;
    /** 关闭选择面板（幂等）：移除遮罩 DOM。 */
    private closePanel;
    /**
     * 打开回合选择面板：逐回合勾选（默认全选）+ 格式挑选，确认后仅导出
     * 选中回合。导出期间确认按钮显示分片进度，再次点击或「取消」中止；
     * 面板随导出结束（含取消）自动关闭。
     */
    private openSelection;
    /**
     * Show a transient toast (bottom-center) for export failures.
     * @param text - the message to show.
     */
    private toast;
}
/** The page-wide controller instance. */
export declare const controller: ExportController;
export {};
