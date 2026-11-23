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

/** Stable id of the injected <style> element. */
const STYLE_ID = 'dsh-conv-export-style'

/**
 * The full stylesheet. Uses the harness --dsw-alias-* design tokens so the
 * menu follows the active theme, with plain-color fallbacks.
 */
const STYLE_TEXT = `
/* ============================================================
   scoped design tokens
   ============================================================ */
[data-dsh-conv-export-menu],
[data-dsh-conv-export-panel-backdrop],
[data-dsh-conv-export-panel] {
  --cx-accent: #3b82f6;
  --cx-radius-xl: 20px;
  --cx-radius-lg: 12px;
  --cx-radius-md: 10px;
  --cx-radius-sm: 8px;
  --cx-ease: cubic-bezier(.16, 1, .3, 1);
  --cx-line: var(--dsw-alias-line-border, rgba(127, 127, 127, .22));
  --cx-line-soft: var(--dsw-alias-line-border, rgba(127, 127, 127, .14));
  --cx-label-1: var(--dsw-alias-label-primary, #111827);
  --cx-label-2: var(--dsw-alias-label-secondary, #374151);
  --cx-label-3: var(--dsw-alias-label-tertiary, #6b7280);
  --cx-bg: var(--dsw-alias-bg-base, #fff);
  --cx-bg-inverse: var(--dsw-alias-bg-inverse, #111827);
  --cx-label-inverse: var(--dsw-alias-label-inverse, #f9fafb);
  --cx-hover: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, .12));
  --cx-focus: rgba(59, 130, 246, .5);
  --cx-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

/* ---- header action button (mirrors dsh-conv-search's) ---- */
.dsh-conv-export-action {
  appearance: none;
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 8px;
  color: var(--dsw-alias-label-tertiary, currentColor);
  cursor: pointer;
  display: inline-flex;
  height: 28px;
  justify-content: center;
  margin: 0;
  padding: 6px;
  width: 28px;
  transition: background .13s ease, color .13s ease;
}
.dsh-conv-export-action:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, .12));
  color: var(--dsw-alias-label-secondary, currentColor);
}
.dsh-conv-export-action:active {
  transform: scale(.94);
}
.dsh-conv-export-action[aria-pressed="true"] {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, .16));
  color: var(--dsw-alias-label-primary, currentColor);
}

/* ============================================================
   dropdown menu — 图标行 + 等宽格式标签 + 右箭头
   ============================================================ */
[data-dsh-conv-export-menu] {
  position: fixed;
  z-index: 1300;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 236px;
  padding: 7px;
  background: var(--cx-bg);
  border: 1px solid var(--cx-line);
  border-radius: 14px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .45),
    0 4px 10px -4px rgba(15, 23, 42, .1),
    0 16px 40px -12px rgba(15, 23, 42, .22);
  color: var(--cx-label-1);
  transform-origin: top right;
  animation: dsh-conv-export-menu-in .16s var(--cx-ease);
}
[data-dsh-conv-export-menu][hidden] {
  display: none;
}
[data-dsh-conv-export-menu] button {
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  padding: 6px 8px;
  border-radius: var(--cx-radius-md);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: background .13s ease;
}
[data-dsh-conv-export-menu] button:hover {
  background: var(--cx-hover);
}
[data-dsh-conv-export-menu] button:active {
  background: rgba(127, 127, 127, .16);
}
/* 图标芯片：静默中性，悬停点亮为 accent —— 色彩只随交互出现。 */
[data-dsh-conv-export-menu] button [data-cx-ico] {
  align-items: center;
  background: rgba(127, 127, 127, .1);
  border-radius: 7px;
  color: var(--cx-label-3);
  display: inline-flex;
  flex: none;
  height: 24px;
  justify-content: center;
  transition: background .13s ease, color .13s ease;
  width: 24px;
}
[data-dsh-conv-export-menu] button:hover [data-cx-ico] {
  background: rgba(59, 130, 246, .13);
  color: var(--cx-accent);
}
[data-dsh-conv-export-menu] button [data-cx-label] {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 等宽格式标签：.md / A4 / PNG —— 技术信息的等宽暗示。 */
[data-dsh-conv-export-menu] button [data-cx-tag] {
  background: rgba(127, 127, 127, .1);
  border-radius: 6px;
  color: var(--cx-label-3);
  flex: none;
  font-family: var(--cx-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: .02em;
  padding: 2px 6px;
  transition: background .13s ease, color .13s ease;
}
[data-dsh-conv-export-menu] button:hover [data-cx-tag] {
  background: rgba(127, 127, 127, .16);
  color: var(--cx-label-2);
}
/* 子面板入口的右箭头：暗示「打开面板」而非「直接导出」。 */
[data-dsh-conv-export-menu] button [data-cx-chevron] {
  color: var(--cx-label-3);
  display: inline-flex;
  flex: none;
  transition: transform .13s var(--cx-ease), color .13s ease;
}
[data-dsh-conv-export-menu] button:hover [data-cx-chevron] {
  color: var(--cx-label-2);
  transform: translateX(1.5px);
}
[data-dsh-conv-export-menu] hr {
  border: 0;
  border-top: 1px solid var(--cx-line-soft);
  margin: 5px 8px;
}

/* ============================================================
   panel shell — 遮罩 + 浮层
   ============================================================ */
[data-dsh-conv-export-panel-backdrop] {
  position: fixed;
  inset: 0;
  z-index: 1350;
  background:
    radial-gradient(120% 90% at 50% 0%, rgba(30, 41, 59, .32), rgba(15, 23, 42, .46)),
    rgba(15, 23, 42, .32);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: dsh-conv-export-fade-in .18s ease-out;
}
[data-dsh-conv-export-panel] {
  background: var(--cx-bg);
  border: 1px solid var(--cx-line);
  border-radius: var(--cx-radius-xl);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .5),
    0 8px 24px -10px rgba(15, 23, 42, .16),
    0 36px 80px -20px rgba(15, 23, 42, .34);
  color: var(--cx-label-1);
  display: flex;
  flex-direction: column;
  max-height: min(82vh, 680px);
  width: min(600px, 92vw);
  overflow: hidden;
  animation: dsh-conv-export-panel-in .24s var(--cx-ease);
}

/* ---- panel header：渐变洗色 + 图标芯片 + 标题/副题 + 关闭 ---- */
[data-dsh-conv-export-panel-title] {
  align-items: center;
  background: linear-gradient(180deg, rgba(59, 130, 246, .05), rgba(59, 130, 246, 0) 82%);
  border-bottom: 1px solid var(--cx-line-soft);
  display: flex;
  gap: 12px;
  padding: 16px 14px 14px 20px;
}
[data-dsh-conv-export-panel-title] [data-cx-ico] {
  align-items: center;
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 55%, #2563eb 100%);
  border-radius: 9px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .4), 0 3px 8px -2px rgba(59, 130, 246, .5);
  color: #fff;
  display: inline-flex;
  flex: none;
  height: 30px;
  justify-content: center;
  width: 30px;
}
[data-dsh-conv-export-panel-title] [data-cx-head] {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
[data-dsh-conv-export-panel-title] [data-cx-title] {
  font-size: 16px;
  font-weight: 650;
  letter-spacing: .2px;
}
[data-dsh-conv-export-panel-title] [data-cx-caption] {
  color: var(--cx-label-3);
  font-size: 12px;
  line-height: 1.45;
}
[data-dsh-conv-export-panel-title] [data-cx-close] {
  appearance: none;
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: var(--cx-radius-sm);
  color: var(--cx-label-3);
  cursor: pointer;
  display: inline-flex;
  flex: none;
  height: 28px;
  justify-content: center;
  margin-left: auto;
  transition: background .12s ease, color .12s ease;
  width: 28px;
}
[data-dsh-conv-export-panel-title] [data-cx-close]:hover {
  background: var(--cx-hover);
  color: var(--cx-label-1);
}

/* ---- toolbar：全选/全不选分段控件 + 计数徽章 ---- */
[data-dsh-conv-export-panel-toolbar] {
  align-items: center;
  border-bottom: 1px solid var(--cx-line-soft);
  display: flex;
  gap: 8px;
  padding: 10px 20px;
}
[data-dsh-conv-export-panel-toolbar] [data-cx-seg] {
  border: 1px solid var(--cx-line);
  border-radius: var(--cx-radius-md);
  display: inline-flex;
  overflow: hidden;
}
[data-dsh-conv-export-panel-toolbar] [data-cx-seg] button {
  appearance: none;
  background: transparent;
  border: 0;
  color: var(--cx-label-2);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  padding: 4.5px 13px;
  transition: background .12s ease, color .12s ease;
}
[data-dsh-conv-export-panel-toolbar] [data-cx-seg] button + button {
  border-left: 1px solid var(--cx-line-soft);
}
[data-dsh-conv-export-panel-toolbar] [data-cx-seg] button:hover {
  background: var(--cx-hover);
  color: var(--cx-label-1);
}
[data-dsh-conv-export-panel-count] {
  background: rgba(127, 127, 127, .12);
  border-radius: 999px;
  color: var(--cx-label-2);
  flex: none;
  font-size: 11.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  margin-left: auto;
  padding: 3.5px 11px;
}

/* ============================================================
   list — 自定义勾选框 + 角色侧标 + 行状态
   ============================================================ */
[data-dsh-conv-export-panel-list] {
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 10px 12px;
  scrollbar-width: thin;
  scrollbar-color: rgba(127, 127, 127, .35) transparent;
}
[data-dsh-conv-export-panel-list]::-webkit-scrollbar {
  width: 10px;
}
[data-dsh-conv-export-panel-list]::-webkit-scrollbar-thumb {
  background: rgba(127, 127, 127, .3);
  background-clip: content-box;
  border: 3px solid transparent;
  border-radius: 8px;
}
[data-dsh-conv-export-panel-list]::-webkit-scrollbar-thumb:hover {
  background: rgba(127, 127, 127, .45);
  background-clip: content-box;
}
[data-dsh-conv-export-panel-item] {
  align-items: flex-start;
  border: 1px solid transparent;
  border-radius: var(--cx-radius-lg);
  cursor: pointer;
  display: flex;
  gap: 10px;
  padding: 9px 12px 9px 19px;
  position: relative;
  transition: background .15s ease, border-color .15s ease;
}
/* 行左侧角色色竖标：选中行点亮，形成蓝/绿交替的色彩节奏。 */
[data-dsh-conv-export-panel-item]::after {
  background: transparent;
  border-radius: 99px;
  bottom: 10px;
  content: "";
  left: 6px;
  opacity: 0;
  position: absolute;
  top: 10px;
  transition: opacity .15s ease;
  width: 3px;
}
[data-dsh-conv-export-panel-item][data-role="user"]::after {
  background: rgba(59, 130, 246, .6);
}
[data-dsh-conv-export-panel-item][data-role="assistant"]::after {
  background: rgba(16, 185, 129, .6);
}
[data-dsh-conv-export-panel-item]:hover {
  background: rgba(127, 127, 127, .07);
}
/* 勾选行：accent 淡染 + 细边框 + 侧标点亮，一眼区分「将导出 / 已排除」。 */
[data-dsh-conv-export-panel-item]:has(input:checked) {
  background: rgba(59, 130, 246, .055);
  border-color: rgba(59, 130, 246, .16);
}
[data-dsh-conv-export-panel-item]:has(input:checked)::after {
  opacity: 1;
}
[data-dsh-conv-export-panel-item]:focus-within {
  outline: 2px solid var(--cx-focus);
  outline-offset: 1px;
}
/* 自定义勾选框：选中做弹跳入场，替代原生控件。 */
[data-dsh-conv-export-panel-item] input {
  -webkit-appearance: none;
  appearance: none;
  background-color: var(--cx-bg);
  background-image: none;
  border: 1.5px solid rgba(127, 127, 127, .5);
  border-radius: 5.5px;
  cursor: pointer;
  flex: none;
  height: 17px;
  margin: 2px 0 0;
  transition: background-color .14s ease, border-color .14s ease, box-shadow .14s ease;
  width: 17px;
}
[data-dsh-conv-export-panel-item] input:hover {
  border-color: rgba(127, 127, 127, .85);
}
[data-dsh-conv-export-panel-item] input:checked {
  animation: dsh-conv-export-check-pop .18s var(--cx-ease);
  background-color: var(--cx-accent);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23ffffff' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3.6 8.6l3.1 3.1 5.9-6.8'/%3E%3C/svg%3E");
  background-position: center;
  background-repeat: no-repeat;
  background-size: 11px;
  border-color: var(--cx-accent);
}
[data-dsh-conv-export-panel-item] input:focus-visible {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, .2);
  outline: none;
}
/* 未勾选行：角色与正文整体降透明度（被排除的视觉信号）。 */
[data-dsh-conv-export-panel-item]:not(:has(input:checked)) [data-dsh-conv-export-panel-item-role],
[data-dsh-conv-export-panel-item]:not(:has(input:checked)) [data-dsh-conv-export-panel-item-text],
[data-dsh-conv-export-panel-item]:not(:has(input:checked)) [data-dsh-conv-export-batch-name],
[data-dsh-conv-export-panel-item]:not(:has(input:checked)) [data-dsh-conv-export-batch-time] {
  opacity: .45;
}
/* 角色徽章：前导圆点 + 分色文字（半透明底在明暗主题下均可读）。 */
[data-dsh-conv-export-panel-item-role] {
  align-items: center;
  border-radius: 999px;
  display: inline-flex;
  flex: none;
  font-size: 11px;
  font-weight: 600;
  gap: 5px;
  line-height: 1.5;
  margin-top: 1px;
  padding: 1px 9px 1px 7px;
}
[data-dsh-conv-export-panel-item-role]::before {
  background: currentColor;
  border-radius: 50%;
  content: "";
  flex: none;
  height: 5.5px;
  width: 5.5px;
}
[data-dsh-conv-export-panel-item][data-role="user"] [data-dsh-conv-export-panel-item-role] {
  background: rgba(59, 130, 246, .12);
  color: #3b82f6;
}
[data-dsh-conv-export-panel-item][data-role="assistant"] [data-dsh-conv-export-panel-item-role] {
  background: rgba(16, 185, 129, .12);
  color: #10b981;
}
[data-dsh-conv-export-panel-item-text] {
  color: var(--cx-label-2);
  display: -webkit-box;
  font-size: 13px;
  line-height: 1.55;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  padding-top: 2px;
  word-break: break-word;
}
[data-dsh-conv-export-panel-item]:has(input:checked) [data-dsh-conv-export-panel-item-text] {
  color: var(--cx-label-1);
}
/* 回合列表入场：前 10 行 12ms 交错，之后统一 100ms（capped）。 */
[data-dsh-conv-export-panel-list][data-cx-stagger] > [data-dsh-conv-export-panel-item] {
  animation: dsh-conv-export-row-in .22s var(--cx-ease) backwards;
}
[data-dsh-conv-export-panel-list][data-cx-stagger] > [data-dsh-conv-export-panel-item]:nth-child(2) { animation-delay: 12ms }
[data-dsh-conv-export-panel-list][data-cx-stagger] > [data-dsh-conv-export-panel-item]:nth-child(3) { animation-delay: 24ms }
[data-dsh-conv-export-panel-list][data-cx-stagger] > [data-dsh-conv-export-panel-item]:nth-child(4) { animation-delay: 36ms }
[data-dsh-conv-export-panel-list][data-cx-stagger] > [data-dsh-conv-export-panel-item]:nth-child(5) { animation-delay: 48ms }
[data-dsh-conv-export-panel-list][data-cx-stagger] > [data-dsh-conv-export-panel-item]:nth-child(6) { animation-delay: 60ms }
[data-dsh-conv-export-panel-list][data-cx-stagger] > [data-dsh-conv-export-panel-item]:nth-child(7) { animation-delay: 72ms }
[data-dsh-conv-export-panel-list][data-cx-stagger] > [data-dsh-conv-export-panel-item]:nth-child(8) { animation-delay: 84ms }
[data-dsh-conv-export-panel-list][data-cx-stagger] > [data-dsh-conv-export-panel-item]:nth-child(9) { animation-delay: 96ms }
[data-dsh-conv-export-panel-list][data-cx-stagger] > [data-dsh-conv-export-panel-item]:nth-child(10) { animation-delay: 108ms }
[data-dsh-conv-export-panel-list][data-cx-stagger] > [data-dsh-conv-export-panel-item]:nth-child(n+11) { animation-delay: 120ms }

/* ---- 列表提示行：加载中（spinner）/ 加载失败（琥珀）/ 空 / 无匹配。 ---- */
[data-dsh-conv-export-panel-note] {
  align-items: center;
  border: 1px dashed rgba(127, 127, 127, .32);
  border-radius: var(--cx-radius-lg);
  color: var(--cx-label-3);
  display: flex;
  flex-direction: column;
  font-size: 13px;
  gap: 9px;
  margin: 12px;
  padding: 26px 16px;
  text-align: center;
}
[data-dsh-conv-export-panel-note]::before {
  background-position: center;
  background-repeat: no-repeat;
  background-size: 18px 18px;
  content: "";
  flex: none;
  height: 18px;
  width: 18px;
}
[data-dsh-conv-export-panel-note][data-cx-kind="loading"]::before {
  animation: dsh-conv-export-spin .7s linear infinite;
  border: 2px solid rgba(127, 127, 127, .25);
  border-radius: 50%;
  border-top-color: rgba(127, 127, 127, .7);
}
[data-dsh-conv-export-panel-note][data-cx-kind="error"]::before {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23f59e0b' stroke-width='1.5' stroke-linecap='round'%3E%3Ccircle cx='8' cy='8' r='6.2'/%3E%3Cpath d='M8 4.9v3.6'/%3E%3Ccircle cx='8' cy='11.1' r='.9' fill='%23f59e0b' stroke='none'/%3E%3C/svg%3E");
}
[data-dsh-conv-export-panel-note][data-cx-kind="empty"]::before {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%2398a2b3' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 10V4.8a1.3 1.3 0 0 1 1.3-1.3h8.4a1.3 1.3 0 0 1 1.3 1.3V10'/%3E%3Cpath d='M2.5 10l1.6 2.5h7.8L13.5 10'/%3E%3Cpath d='M2.5 10h3.2l.9 1.4h2.8l.9-1.4h3.2'/%3E%3C/svg%3E");
}
[data-dsh-conv-export-panel-note] button {
  appearance: none;
  background: transparent;
  border: 1px solid var(--cx-line);
  border-radius: 999px;
  color: var(--cx-label-2);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 14px;
  transition: background .12s ease, color .12s ease;
}
[data-dsh-conv-export-panel-note] button:hover {
  background: var(--cx-hover);
  color: var(--cx-label-1);
}

/* ---- 格式行：内嵌分段控件（iOS 风格 track + 反色活动段）。 ---- */
[data-dsh-conv-export-panel-format] {
  align-items: center;
  border-top: 1px solid var(--cx-line-soft);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 13px 20px;
}
[data-dsh-conv-export-panel-format-label] {
  color: var(--cx-label-3);
  font-size: 12px;
  font-weight: 500;
}
[data-dsh-conv-export-panel-format] [data-cx-group] {
  background: rgba(127, 127, 127, .1);
  border-radius: 11px;
  display: inline-flex;
  gap: 2px;
  padding: 3px;
}
[data-dsh-conv-export-panel-format-option] {
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 8px;
  color: var(--cx-label-2);
  cursor: pointer;
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  padding: 5px 15px;
  transition: background .15s ease, color .15s ease, box-shadow .15s ease;
}
[data-dsh-conv-export-panel-format-option]:hover {
  color: var(--cx-label-1);
}
/* 激活格式：反色填充 + 微投影，与主按钮同一强调语言。 */
[data-dsh-conv-export-panel-format-option][aria-pressed="true"] {
  background: var(--cx-bg-inverse);
  box-shadow: 0 1px 4px rgba(15, 23, 42, .22);
  color: var(--cx-label-inverse);
  font-weight: 600;
}

/* ---- footer：次级幽灵按钮 + 主按钮（悬停抬升，运行中转 spinner）。 ---- */
[data-dsh-conv-export-panel-footer] {
  border-top: 1px solid var(--cx-line-soft);
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 14px 20px 18px;
}
[data-dsh-conv-export-panel-secondary] {
  appearance: none;
  background: transparent;
  border: 1px solid var(--cx-line);
  border-radius: 11px;
  color: var(--cx-label-2);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 16px;
  transition: background .12s ease, color .12s ease;
}
[data-dsh-conv-export-panel-secondary]:hover {
  background: var(--cx-hover);
  color: var(--cx-label-1);
}
[data-dsh-conv-export-panel-primary] {
  appearance: none;
  align-items: center;
  background: var(--cx-bg-inverse);
  border: 0;
  border-radius: 11px;
  box-shadow: 0 2px 8px -2px rgba(15, 23, 42, .35);
  color: var(--cx-label-inverse);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  gap: 8px;
  justify-content: center;
  min-width: 108px;
  padding: 8px 18px;
  transition: filter .13s ease, transform .13s var(--cx-ease), box-shadow .13s ease;
}
[data-dsh-conv-export-panel-primary]:hover {
  box-shadow: 0 5px 14px -4px rgba(15, 23, 42, .42);
  filter: brightness(1.12);
  transform: translateY(-1px);
}
[data-dsh-conv-export-panel-primary]:active {
  transform: translateY(0) scale(.985);
}
[data-dsh-conv-export-panel-primary]:disabled {
  box-shadow: none;
  cursor: not-allowed;
  filter: grayscale(.4);
  opacity: .55;
  transform: none;
}
/* 运行中：单弧 spinner（currentColor 随主题反色）+ 保持可点击（再次点击即中止）。 */
[data-dsh-conv-export-panel-primary][data-cx-state="running"]::before {
  animation: dsh-conv-export-spin .7s linear infinite;
  border: 2px solid transparent;
  border-radius: 50%;
  border-top-color: currentColor;
  content: "";
  flex: none;
  height: 12px;
  width: 12px;
}

/* ---- 键盘可达性：统一 focus-visible 环。 ---- */
[data-dsh-conv-export-panel-format-option]:focus-visible,
[data-dsh-conv-export-panel-toolbar] button:focus-visible,
[data-dsh-conv-export-panel-secondary]:focus-visible,
[data-dsh-conv-export-panel-primary]:focus-visible,
[data-dsh-conv-export-panel-title] [data-cx-close]:focus-visible,
[data-dsh-conv-export-menu] button:focus-visible {
  outline: 2px solid var(--cx-focus);
  outline-offset: 1px;
}

/* ============================================================
   batch session panel — 搜索框 + 会话行
   ============================================================ */
[data-dsh-conv-export-batch-search] {
  background-color: rgba(127, 127, 127, .05);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%2398a2b3' stroke-width='1.6' stroke-linecap='round'%3E%3Ccircle cx='7' cy='7' r='4.2'/%3E%3Cpath d='M10.2 10.2L13.5 13.5'/%3E%3C/svg%3E");
  background-position: 11px center;
  background-repeat: no-repeat;
  background-size: 15px;
  border: 1px solid var(--cx-line);
  border-radius: var(--cx-radius-md);
  color: var(--cx-label-1);
  font: inherit;
  font-size: 13px;
  margin: 12px 20px 0;
  padding: 8px 12px 8px 33px;
  transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease;
}
[data-dsh-conv-export-batch-search]::placeholder {
  color: var(--cx-label-3);
}
[data-dsh-conv-export-batch-search]:focus {
  background-color: var(--cx-bg);
  border-color: rgba(59, 130, 246, .55);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, .14);
  outline: none;
}
/* 会话行：标题（单行截断）+ 创建时间（右侧固定，等宽数字）。 */
[data-dsh-conv-export-batch-name] {
  color: var(--cx-label-2);
  flex: 1;
  font-size: 13px;
  line-height: 1.55;
  min-width: 0;
  overflow: hidden;
  padding-top: 2px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
[data-dsh-conv-export-panel-item]:has(input:checked) [data-dsh-conv-export-batch-name] {
  color: var(--cx-label-1);
}
[data-dsh-conv-export-batch-time] {
  color: var(--cx-label-3);
  flex: none;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  padding-top: 4px;
  white-space: nowrap;
}

/* ============================================================
   failure toast — 深色玻璃药丸 + 信息图标 + 上滑入场
   ============================================================ */
[data-dsh-conv-export-toast] {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1400;
  align-items: center;
  background: rgba(17, 24, 39, .94);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 12px;
  box-shadow: 0 12px 32px -8px rgba(15, 23, 42, .5), inset 0 1px 0 rgba(255, 255, 255, .08);
  color: #f9fafb;
  display: inline-flex;
  font-size: 13px;
  font-weight: 500;
  gap: 9px;
  padding: 9px 16px 9px 14px;
  animation: dsh-conv-export-toast-in .2s var(--cx-ease);
}
[data-dsh-conv-export-toast]::before {
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23ffffff' stroke-width='1.5' stroke-linecap='round'%3E%3Ccircle cx='8' cy='8' r='6.2'/%3E%3Cpath d='M8 7.4v3.4'/%3E%3Ccircle cx='8' cy='5.1' r='.9' fill='%23ffffff' stroke='none'/%3E%3C/svg%3E") center / contain no-repeat;
  content: "";
  flex: none;
  height: 15px;
  width: 15px;
}

/* ============================================================
   motion — 入场动画 + 减动效偏好
   ============================================================ */
@keyframes dsh-conv-export-fade-in {
  from { opacity: 0 }
  to { opacity: 1 }
}
@keyframes dsh-conv-export-menu-in {
  from { opacity: 0; transform: translateY(-4px) scale(.97) }
  to { opacity: 1; transform: translateY(0) scale(1) }
}
@keyframes dsh-conv-export-panel-in {
  from { opacity: 0; transform: translateY(12px) scale(.975) }
  to { opacity: 1; transform: translateY(0) scale(1) }
}
@keyframes dsh-conv-export-row-in {
  from { opacity: 0; transform: translateY(4px) }
  to { opacity: 1; transform: translateY(0) }
}
@keyframes dsh-conv-export-check-pop {
  0% { transform: scale(.72) }
  60% { transform: scale(1.08) }
  100% { transform: scale(1) }
}
@keyframes dsh-conv-export-spin {
  to { transform: rotate(360deg) }
}
@keyframes dsh-conv-export-toast-in {
  from { opacity: 0; transform: translate(-50%, 8px) }
  to { opacity: 1; transform: translate(-50%, 0) }
}
@media (prefers-reduced-motion: reduce) {
  [data-dsh-conv-export-menu],
  [data-dsh-conv-export-panel-backdrop],
  [data-dsh-conv-export-panel],
  [data-dsh-conv-export-toast],
  [data-dsh-conv-export-panel-list][data-cx-stagger] > [data-dsh-conv-export-panel-item],
  [data-dsh-conv-export-panel-item] input:checked {
    animation: none;
  }
}
`

/**
 * Inject the stylesheet once. Safe to call from multiple mount paths.
 */
export function adoptStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLE_TEXT
  document.head.appendChild(style)
}
