# dsh-conv-export（对话导出）

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-blue)](https://github.com/topics/dsh-plugin)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek-Harness-orange)](https://github.com/deepseek-ai/deepseek-harness)

English | [中文](README.md)

> **What this fork changes (v0.2.0)**: ① **Batch export removed** — upstream's host half mounted an *unauthenticated* `/conv-export` prefix route via `ctx.webServer`, so any local process could pull every session's full text with no token (`/api/*` answers 401); its list endpoint re-folded titles from logs on every call (18s+ measured), and the log-derived Markdown also carried `<system-reminder>` / AGENTS.md out. This fork deletes the host half entirely — `manifest.json` no longer requests the `webServer` / `sessionQuery` permissions. ② **Per-turn export added** — every finalized assistant reply's action strip (the `conversation.chat.assistant-actions` slot) gets a download button that opens the same menu scoped to that turn.

Export the current DeepSeek Harness conversation — or **a single turn** of it — as **Markdown**, a **self-contained single-file HTML**, a **PDF** (downloaded directly — no print dialog), or a **long PNG image**, and **copy the Markdown** to the clipboard in one click, from the session header or the bubble's own strip: one click, zero core changes, browser-only.

## Problems it solves

- **Conversations evaporate**: long sessions hold decisions, code, and error trails, but the harness has no built-in way to take them out. This plugin turns the rendered transcript into portable artifacts.
- **One format never fits**: sharing with a teammate wants Markdown; archiving for compliance wants PDF; pasting into chat wants an image. All three ship in one menu.
- **The whole transcript is often not the part you want**: just one answer — the strip button under that bubble exports exactly that turn, with `-turnN` appended to the file name.
- **Exports must match what you see**: extraction runs at click time over the rendered DOM (including paged-in history), so the artifact is exactly the transcript on screen — code fences, tables, and emphasis preserved; thinking blocks, tool cards, and injected instruction layers are not part of the rendered body, so they never enter the artifact.

## Features

- **Header export button** (download glyph) registered into the `conversation.session.header.actions` slot — additive, safely uninstalled, and mirrors its open state via `aria-pressed`.
- **Per-turn export button** (download glyph) registered into `conversation.chat.assistant-actions` — it lands in every finalized assistant reply's copy/like strip; clicking it reuses the same menu but scopes extraction to that turn. Resolution degrades through three probes: ① the slot's `messageId` → matching `[data-chat-anchor-key]` seat; ② button-ordinal mapping — one button per reply, so equal counts map the Nth button to the Nth body (this defeats layouts where strips don't interleave with bodies and "nearest preceding" collapses to the first reply); ③ document order — the body immediately preceding the strip. A user question directly before the chosen body joins the segment; the button adopts its neighbours' classes at mount so colour/metrics/hover match the strip and any skin. The menu hides "Select turns…" in per-turn mode and the file name gains a `-turnN` ordinal.
- **Dropdown menu** with six entries (the fifth is hidden in per-turn mode):
  - **Markdown (.md)** — client-side download; assistant turns are serialized back from rendered HTML (headings, lists, fenced code with language, tables, blockquotes, links, inline emphasis).
  - **HTML (.html)** — a self-contained single file: styles inlined, images converted to data URLs, opens with a double-click and shares as-is; text stays selectable and searchable, and the embedded print stylesheet makes "print → save as PDF" the selectable-text alternative to the raster PDF.
  - **PDF (download)** — tiled rasterization sliced into A4-proportioned pages (page boundaries align with tile boundaries, page count unbounded, peak memory bounded to one tile), downloaded as a self-contained multi-page PDF. No print window, no dialog: the app tab never freezes.
  - **Long image (PNG)** — tiled rasterization (`foreignObject` windows via `translateY`, tile height = A4 page height × 2) plus a streaming PNG encoder (tile-level adaptive row filtering → incremental `CompressionStream('deflate')` compression), images inlined as data URLs. The PNG spec has no height cap; the sane ceiling is ~176 A4 pages (200,000 CSS px). Environments without `CompressionStream` fall back to the legacy single-canvas truncation path (16000px).
  - **Copy Markdown** — writes the Markdown straight to the clipboard, skipping the download-open-copy round trip; degrades to a visible hint when the clipboard is unavailable (insecure context).
  - **Select turns…** — opens a turn-selection panel: check turns individually (role + content preview, all checked by default), select all/none with a live count, pick the export format (Markdown / HTML / PDF / long image), and confirm to export only the checked turns (e.g. drop failed attempts or off-topic tangents). During export the confirm button shows tile progress; clicking it again or Cancel aborts.
- **Sensible file names** from the session title (sanitized, capped); per-turn exports append `-turnN`.
- Follows the harness `--dsw-alias-*` design tokens; menu labels resolve against the **live** `<html lang>` — the first read is no longer cached forever (early builds froze on the product-default `en` before the locale plugin wrote `zh-CN`, leaving the UI English), so language switches apply immediately; a still-untouched `en` with a Chinese browser falls back to Chinese.
- Menu hygiene: Escape or outside-click closes; rasterizing menu items show live `done/total` progress and re-clicking the same item cancels the in-flight export; a toast reports long-image raster failures. The selection panel closes via Escape or backdrop click when idle, and via the Cancel button mid-export.

## Install

Requires Node.js ≥ 22 and pnpm (`npm install -g pnpm`) — `dsh plugin add` installs the bundle into the profile with pnpm.

### One-liner (this fork)

```sh
dsh plugin add ZIye1208/dsh-conv-export --profile web
dsh web   # restart the server to pick the plugin up
```

> Common follow-ups: upgrade `dsh plugin upgrade dsh-conv-export --profile web`; uninstall `dsh plugin remove dsh-conv-export --profile web`; local-path install `dsh plugin add ./dsh-conv-export --profile web`. The desktop profile is owned by the Electron app — install through the desktop plugin flow instead.

The package declares `dsh.bundle.patch` (mounts the plugin registration row the boot graph scans for `dsh.client`) and `dsh.client` (serves the browser half at `/plugins/<id>/client.js`). `lib/` is committed, so the GitHub tarball installs without a build step.

## Usage

- **Whole conversation**: open any conversation, click the download icon in the session header, pick a format. All four download formats download directly — no dialogs, the app tab stays responsive; "Copy Markdown" writes straight to the clipboard.
- **One turn**: click the download icon in that reply's action strip — same menu (with "Select turns…" hidden), file name gains `-turnN`.
- **A hand-picked set of turns**: header menu → "Select turns…", check them, pick a format.

Everything exports as conversation body only: thinking blocks, tool call/result cards, and the injected `<system-reminder>` layer are not part of the rendered body, so they never appear in the artifact (only the removed log-derived batch path carried them out).

## How it works

- Every path (Markdown / HTML / PDF / long image / turn selection / per-turn export) lives in the browser bundle (`lib/client.js`), mounted by the stock loader with zero core changes and no host services. The host entry `src/index.ts` is an empty shell — this fork dropped upstream's `/conv-export` service layer (`webServer` + `sessionQuery`), and `manifest.json` no longer requests either permission.
- Whole-transcript extraction walks `[data-conversation-scroll]` in document order, pairing user rows (`[class*="_userRow"]` bubbles) with assistant markdown containers (`[class*="_markdown_"]`) — the stock renderer's stable class contracts.
- Per-turn extraction (`extractTurn`) degrades through three probes: ① the `messageId` seat — the pane keys chat-node seats by message key, so the slot's id pins the body exactly; ② button-ordinal mapping when button and body counts match; ③ document order — the outermost body immediately preceding the strip (its successor when the strip renders above the body). The user question adjacent to the chosen body joins the segment; the turn ordinal is that body's position among the pane's outermost markdown containers, feeding the `-turnN` file name.
- The long-image/PDF paths use tiled rasterization: an offscreen stage stays mounted as the clone source, and each tile serializes a clean clone (explicit XHTML namespace, no offscreen offsets, `translateY(−offset)` window displacement) into an SVG `foreignObject`, validates it with `DOMParser`, then rasterizes onto an independent 2x canvas (tile height = A4 page height × 2). External images are fetched and inlined first; unreachable ones are dropped rather than tainting the canvas. PNG rows stream through a tile-level adaptive filter into `CompressionStream('deflate')` incremental compression — exactly the zlib stream the PNG spec requires.

## Known limitations

- The long-image and PDF paths rasterize through SVG `foreignObject` (all evergreen browsers paint it); exotic embedded content may flatten.
- PDF pages are raster images (text is not selectable); for selectable text use the Markdown or HTML export (the latter also prints to a selectable-text PDF from the browser).
- Export scope is the active conversation column only — sidebar titles and settings pages are out of scope.
- Per-turn export depends on the `conversation.chat.assistant-actions` slot and the turn's chat-node seat: if DSH renames either, it degrades to the body nearest the button, and in the worst case may pick an adjacent turn — use "Select turns…" to check the exact ones then.
- No batch export in this fork: for cross-session archiving use the official `/export` (session header → Session log, exports the raw session log ZIP).

## Troubleshooting

- `'pnpm' is not recognized` during `dsh plugin add` → install pnpm first: `npm install -g pnpm`.
- `ETIMEDOUT` fetching the GitHub tarball → pnpm/Node ignores the Windows system proxy (browsers read it; terminals don't). Fix once, forever — persist your proxy into npm config (pnpm reads it too):

  ```powershell
  $s = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
  if ($s.ProxyEnable -and $s.ProxyServer) {
    npm config set proxy "http://$($s.ProxyServer)"
    npm config set https-proxy "http://$($s.ProxyServer)"
  }
  ```

  Every later `dsh plugin add` / `pnpm` / `npm` call then goes through the proxy with no env vars. Undo with `npm config delete proxy; npm config delete https-proxy` when running without the proxy tool. Per-session alternative: `$env:HTTPS_PROXY = "http://$($s.ProxyServer)"`. Or switch the proxy tool to TUN/global mode so all traffic is covered. Prefer a fixed port? Pick an obscure one such as **49151** — the last registered port before the dynamic range, so no common service, no ephemeral allocation, and no proxy tool default ever lands on it. Port-free fallback: download the tarball in your browser and install locally: `dsh plugin --profile web add .\Downloads\main.tar.gz`.
- `EADDRINUSE ... :3080` on `dsh web` → a previous `dsh web` is still bound to the port. Stop it (Ctrl+C in its terminal; on Windows: `Get-NetTCPConnection -LocalPort 3080 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`), or start on another port with `dsh web --port 3081`.

## License

MIT
