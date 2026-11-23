/**
 * Global stylesheet adoption: the export dropdown chrome, the header action
 * button, the turn-selection panel, the batch session panel, and the failure
 * toast. Injected once into document.head with a stable id so repeated
 * plugin loads never double-inject.
 *
 * 视觉系统「墨与玻璃（Ink & Glass）」：
 * - 结构分层：发丝线分隔各区块，面板 20px 大圆角 + 三层冷调投影 + 内侧
 *   顶高光，营造「浮在页面上」的物理深度。
 * - 克制用色：中性灰做全部界面底色；蓝色（accent）只表达「选择与行动」；
 *   角色色（用户 = 蓝、助手 = 绿）只出现在徽章与行侧标，形成列表的
 *   色彩节奏。
 * - 物理动效：统一 expo-out 曲线（.16,1,.3,1），160~240ms；回合列表
 *   入场做 capped 交错；全部尊重 prefers-reduced-motion。
 * - 主题跟随：颜色一律走 --dsw-alias-* 令牌，回退为明暗主题均可读的
 *   中性色。
 */
/**
 * Inject the stylesheet once. Safe to call from multiple mount paths.
 */
export declare function adoptStyles(): void;
