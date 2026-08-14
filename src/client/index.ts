/**
 * dsh-conv-export browser half: export the current conversation as
 * Markdown, PDF, or a long PNG image.
 *
 * One contribution: an export icon button in the session header's action
 * row, registered into the harness's `conversation.session.header.actions`
 * slot (the additive seat for per-session controls beside the title). The
 * button opens a dropdown with the three sinks; extraction runs at click
 * time over the rendered transcript, so exports always match what the
 * reader sees.
 *
 * Zero core changes: everything rides cordis effects and the declared slot.
 */
import { createElement, type ReactElement } from 'react'
import { controller } from './controller.ts'
import { adoptStyles } from './styles.ts'
import { t } from './i18n.ts'

/** Stable Cordis plugin name (matches the manifest id). */
export const name = '@dsh-external/dsh-conv-export'

/** Required services: the slot registry (the header action seat rides it). */
export const inject = ['slots']

/**
 * Minimal structural face of the slot service this plugin uses. Declared
 * locally (not imported) so the client bundle stays pure: cross-package
 * value imports are forbidden, and the only runtime dependency is the slot
 * service shape every stock web app provides.
 */
interface SlotsFace {
  inject(key: 'conversation.session.header.actions', callback: () => () => void): () => void
  register(
    options: {
      name: 'conversation.session.header.actions'
      id: string
      order: number
      inject: () => Record<string, never>
    },
    component: (props: HeaderActionProps) => ReactElement | null,
  ): () => void
}

/** Minimal client context face (the slot service is the only dependency). */
interface ClientContextFace {
  slots: SlotsFace
  effect(effect: () => (() => void) | void, label?: string): () => Promise<void>
}

/**
 * The header action button props. The slot renderer spreads the standard
 * session kit (sessionId, useSession, ...) plus the owner share; the button
 * needs none of it, so the type stays open.
 */
interface HeaderActionProps {
  readonly sessionId?: string
}

/**
 * The session-header export button: toggles the dropdown. Pure presentation
 * over the global controller.
 * @param _props - the slot's standard kit (unused).
 * @returns the icon button.
 */
function ExportActionButton(_props: HeaderActionProps): ReactElement {
  // Inline 16px download glyph (no icon-package import keeps the bundle's
  // only runtime dependency on React).
  const icon = createElement(
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
    icon,
  )
}

/**
 * Browser plugin body: install the controller's document effects and
 * register the header action button into the session header slot.
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
}
