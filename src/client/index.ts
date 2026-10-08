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
import { createElement, type ReactElement } from 'react'
import { controller } from './controller.ts'
import { TURN_BUTTON_CLASS } from './extract.ts'
import { adoptStyles } from './styles.ts'
import { t } from './i18n.ts'

/** Stable Cordis plugin name (matches the manifest id). */
export const name = '@dsh-external/dsh-conv-export'

/** Required services: the slot registry (both seats ride it). */
export const inject = ['slots']

/** The two slot keys this plugin contributes to. */
type SlotKey = 'conversation.session.header.actions' | 'conversation.chat.assistant-actions'

/**
 * Minimal structural face of the slot service this plugin uses. Declared
 * locally (not imported) so the client bundle stays pure: cross-package
 * value imports are forbidden, and the only runtime dependency is the slot
 * service shape every stock web app provides.
 */
interface SlotsFace {
  inject(key: SlotKey, callback: () => () => void): () => void
  register(
    options: {
      name: SlotKey
      id: string
      order: number
      inject: () => Record<string, never>
    },
    component: (props: SlotProps) => ReactElement | null,
  ): () => void
}

/** Minimal client context face (the slot service is the only dependency). */
interface ClientContextFace {
  slots: SlotsFace
  effect(effect: () => (() => void) | void, label?: string): () => Promise<void>
}

/**
 * Slot props: the header kit carries `sessionId`; the assistant-actions strip
 * carries `messageId`, which pins the exact reply during extraction.
 */
interface SlotProps {
  readonly sessionId?: string
  readonly messageId?: string
}

/**
 * Adopt the strip's own button styling: copy the sibling button's class list
 * onto ours, so colour, metrics, hover and skin overrides come out identical
 * instead of our neutral defaults fighting the theme. Falls back to the
 * `:where(.dsh-conv-export-turn)` base when no sibling button exists yet.
 * @param el - the freshly mounted per-turn button.
 */
function adoptStripLook(el: HTMLElement): void {
  const strip = el.parentElement
  if (strip === null) return
  const buttons = Array.from(strip.querySelectorAll('button'))
    .filter((node): node is HTMLButtonElement =>
      node !== el && !node.classList.contains(TURN_BUTTON_CLASS))
  const sibling = buttons[0]
  if (sibling === undefined) return
  for (const cls of Array.from(sibling.classList)) {
    if (!el.classList.contains(cls)) el.classList.add(cls)
  }
}

/**
 * Inline 16px download glyph (no icon-package import keeps the bundle's
 * only runtime dependency on React).
 * @returns the glyph element.
 */
function downloadGlyph(): ReactElement {
  return createElement(
    'svg',
    { viewBox: '0 0 16 16', width: 16, height: 16, fill: 'none', 'aria-hidden': true },
    createElement('path', {
      d: 'M8 2v8m0 0 3-3M8 10 5 7',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
    createElement('path', {
      d: 'M3 12.5v1A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-1',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
    }),
  )
}

/**
 * The session-header export button: toggles the dropdown. Pure presentation
 * over the global controller.
 * @param _props - the slot's standard kit (unused).
 * @returns the icon button.
 */
function ExportActionButton(_props: SlotProps): ReactElement {
  return createElement(
    'button',
    {
      type: 'button',
      className: 'dsh-conv-export-action',
      title: t('action.hint'),
      'aria-label': t('action.aria'),
      'aria-pressed': 'false',
      onClick: (e: { currentTarget: EventTarget }) => {
        controller.toggle(e.currentTarget as Element)
      },
    },
    downloadGlyph(),
  )
}

/**
 * The per-turn export button rendered into every finalized assistant
 * reply's IconActions strip: opens the same dropdown scoped to this turn.
 * @param props - the strip's kit; `messageId` pins the exact reply.
 * @returns the icon button.
 */
function TurnExportButton(props: SlotProps): ReactElement {
  return createElement(
    'button',
    {
      type: 'button',
      className: TURN_BUTTON_CLASS,
      title: t('turn.hint'),
      'aria-label': t('turn.aria'),
      'aria-pressed': 'false',
      // 挂载后吸收同排按钮的 class：颜色/尺寸/hover 与皮肤一并跟随。
      ref: (el: HTMLElement | null): void => {
        if (el !== null) adoptStripLook(el)
      },
      onClick: (e: { currentTarget: EventTarget }) => {
        controller.toggle(e.currentTarget as Element, props.messageId)
      },
    },
    downloadGlyph(),
  )
}

/**
 * Browser plugin body: install the controller's document effects and
 * register both export buttons into their slots.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContextFace): void {
  adoptStyles()

  // Menu DOM + outside-click / Escape close; torn down on plugin unload.
  ctx.effect(() => {
    controller.install()
    return () => { controller.uninstall() }
  }, 'dsh-conv-export: controller')

  // The header action button rides the slot declaration lifetime: present
  // while ui-conversation declares the seat, gone (and re-armed) across
  // runtime swaps.
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'dsh-conv-export-action',
    order: 110,
    inject: () => ({}),
  }, ExportActionButton))

  // Per-turn entry in the assistant strip (copy / like / dislike / … row).
  // order 50 lands after the feedback entry (10) and before late extras.
  ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
    name: 'conversation.chat.assistant-actions',
    id: 'dsh-conv-export-turn',
    order: 50,
    inject: () => ({}),
  }, TurnExportButton))
}
