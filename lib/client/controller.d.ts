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
    /** 选择面板（backdrop 元素；回合面板与批量面板共用此槽位）；null = 未打开。 */
    private panel;
    private installed;
    private running;
    /** 批量面板：会话列表拉取的取消控制器（面板关闭时中止）。 */
    private batchListAbort;
    /** 批量面板：打包请求的取消控制器（非 null 期间面板不可关闭）。 */
    private batchRun;
    /** Install the menu DOM and document listeners. Idempotent. */
    install(): void;
    /** Remove every installed effect. Idempotent. */
    uninstall(): void;
    /**
     * Toggle the dropdown (the header action button's gesture), anchoring it
     * under the triggering button. 选择面板打开时不弹菜单。
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
     */
    private execute;
    /** 关闭选择/批量面板（幂等）：中止批量面板的在途请求后移除 DOM。 */
    private closePanel;
    /**
     * 打开回合选择面板：逐回合勾选（默认全选）+ 格式挑选，确认后仅导出
     * 选中回合。导出期间确认按钮显示分片进度，再次点击或「取消」中止；
     * 面板随导出结束（含取消）自动关闭。
     */
    private openSelection;
    /**
     * 打开批量导出面板（能力吸收自 dsh-companion）：拉取历史会话列表，
     * 按标题/ID 实时筛选、逐个勾选、全选/全不选（作用于当前筛选结果并与
     * 已有选择取并集）、已选计数；确认后将所选会话各生成一份 Markdown
     * 打包为 ZIP 下载（单次最多 100 个会话，自动去重，读取失败自动跳过）。
     * 打包进行中确认按钮显示「正在打包…」，再次点击或「取消」中止。
     */
    private openBatch;
    /**
     * Show a transient toast (bottom-center) for export failures.
     * @param text - the message to show.
     */
    private toast;
}
/** The page-wide controller instance. */
export declare const controller: ExportController;
export {};
