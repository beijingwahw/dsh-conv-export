/**
 * Global stylesheet adoption: the export dropdown chrome, the header action
 * button, and the failure toast. Injected once into document.head with a
 * stable id so repeated plugin loads never double-inject.
 */

/** Stable id of the injected <style> element. */
const STYLE_ID = 'dsh-conv-export-style'

/**
 * The full stylesheet. Uses the harness --dsw-alias-* design tokens so the
 * menu follows the active theme, with plain-color fallbacks.
 */
const STYLE_TEXT = `
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
}
.dsh-conv-export-action:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, .12));
  color: var(--dsw-alias-label-secondary, currentColor);
}
.dsh-conv-export-action[aria-pressed="true"] {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, .16));
  color: var(--dsw-alias-label-primary, currentColor);
}

/* ---- dropdown menu ---- */
[data-dsh-conv-export-menu] {
  position: fixed;
  z-index: 1300;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 176px;
  padding: 6px;
  background: var(--dsw-alias-bg-base, #fff);
  border: 1px solid var(--dsw-alias-line-border, rgba(127, 127, 127, .22));
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, .18);
  color: var(--dsw-alias-label-primary, #111827);
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
  text-align: left;
  padding: 7px 10px;
  border-radius: 8px;
  white-space: nowrap;
}
[data-dsh-conv-export-menu] button:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, .12));
}

/* ---- failure toast ---- */
[data-dsh-conv-export-toast] {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1400;
  background: #111827;
  color: #f9fafb;
  font-size: 13px;
  padding: 8px 16px;
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, .28);
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
