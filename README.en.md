# dsh-conv-export（对话导出）

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-blue)](https://github.com/topics/dsh-plugin)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek-Harness-orange)](https://github.com/deepseek-ai/deepseek-harness)

English | [中文](README.md)

Export the current DeepSeek Harness conversation as **Markdown**, a **self-contained single-file HTML**, a **PDF** (downloaded directly — no print dialog), or a **long PNG image**, **copy the Markdown** to the clipboard in one click, and **batch-export** multiple historical sessions as a Markdown ZIP — one click in the session header, zero core changes.

## Problems it solves

- **Conversations evaporate**: long sessions hold decisions, code, and error trails, but the harness has no built-in way to take them out. This plugin turns the rendered transcript into portable artifacts.
- **One format never fits**: sharing with a teammate wants Markdown; archiving for compliance wants PDF; pasting into chat wants an image. All three ship in one menu.
- **One artifact often isn't enough either**: handoffs and archives frequently need several historical sessions in one go. Batch export renders each as its own Markdown file and packs them into a single ZIP.
- **The ZIP itself is an archive**: every batch-export ZIP ships with an `index.html` offline viewer and a machine-readable `manifest.json` — unzip, double-click, and browse all sessions with instant full-text search, per-session copy / download, no server and no network required. The viewer is also a **smart archive**: the sidebar lays sessions out on a date-grouped timeline, each entry carries a first-question preview (know the topic without opening it), and a stats bar sums up session count / total turns / time span; the manifest mirrors per-session `preview` fields and a global `stats` block, so scripts and external tooling can consume the archive profile directly.
- **Exports must match what you see**: extraction runs at click time over the rendered DOM (including paged-in history), so the artifact is exactly the transcript on screen — code fences, tables, and emphasis preserved.

## Features

- **Header export button** (download glyph) registered into the `conversation.session.header.actions` slot — additive, safely uninstalled, and mirrors its open state via `aria-pressed`.
- **Dropdown menu** with five sinks plus turn selection:
  - **Markdown (.md)** — client-side download; assistant turns are serialized back from rendered HTML (headings, lists, fenced code with language, tables, blockquotes, links, inline emphasis).
  - **HTML (.html)** — a self-contained single file: styles inlined, images converted to data URLs, opens with a double-click and shares as-is; text stays selectable and searchable, and the embedded print stylesheet makes "print → save as PDF" the selectable-text alternative to the raster PDF.
  - **PDF (download)** — tiled rasterization sliced into A4-proportioned pages (page boundaries align with tile boundaries, page count unbounded, peak memory bounded to one tile), downloaded as a self-contained multi-page PDF. No print window, no dialog: the app tab never freezes.
  - **Long image (PNG)** — tiled rasterization (`foreignObject` windows via `translateY`, tile height = A4 page height × 2) plus a streaming PNG encoder (tile-level adaptive row filtering → incremental `CompressionStream('deflate')` compression), images inlined as data URLs. The PNG spec has no height cap; the sane ceiling is ~176 A4 pages (200,000 CSS px). Environments without `CompressionStream` fall back to the legacy single-canvas truncation path (16000px).
  - **Copy Markdown** — writes the Markdown straight to the clipboard, skipping the download-open-copy round trip; degrades to a visible hint when the clipboard is unavailable (insecure context).
  - **Select turns…** — opens a turn-selection panel: check turns individually (role + content preview, all checked by default), select all/none with a live count, pick the export format (Markdown / HTML / PDF / long image), and confirm to export only the checked turns (e.g. drop failed attempts or off-topic tangents). During export the confirm button shows tile progress; clicking it again or Cancel aborts.
  - **Batch export sessions…** — opens a session-selection panel: real-time filtering by title / session ID, per-session checkboxes, select all/none (applies to the current filter result and unions with the existing selection), and a live selected count. Confirm and each selected session is rendered as its own Markdown, packed into a single ZIP download (up to 100 sessions per run, auto-deduplicated; unreadable sessions are skipped without blocking the rest). While packing, the confirm button shows "Packing…" and clicking it again or Cancel aborts; Escape / backdrop clicks don't close the panel mid-pack.
- **Sensible file names** from the session title (sanitized, capped).
- Follows the harness `--dsw-alias-*` design tokens; menu labels switch zh/en by document language.
- Menu hygiene: Escape or outside-click closes; rasterizing menu items show live `done/total` progress and re-clicking the same item cancels the in-flight export; a toast reports long-image raster failures. The selection panel closes via Escape or backdrop click when idle, and via the Cancel button mid-export.

## Install

Requires Node.js ≥ 22 and pnpm (`npm install -g pnpm`) — `dsh plugin add` installs the bundle into the profile with pnpm.

### One-liner

```sh
dsh plugin add beijingwahw/dsh-conv-export --profile web
dsh web   # restart the server to pick the plugin up
```

> Common follow-ups: upgrade `dsh plugin upgrade dsh-conv-export --profile web`; uninstall `dsh plugin remove dsh-conv-export --profile web`; local-path install `dsh plugin add ./dsh-conv-export --profile web`.

The package declares `dsh.bundle.patch` (mounts the host registration row) and `dsh.client` (serves the browser half at `/plugins/<id>/client.js`). `lib/` is committed, so the GitHub tarball installs without a build step.

## Usage

Open any conversation, click the download icon in the session header, pick a format. All four download formats download directly — no dialogs, the app tab stays responsive; "Copy Markdown" writes straight to the clipboard.

**Batch export**: pick "Batch export sessions…" from the menu, filter and check the target sessions in the panel, confirm, and a ZIP downloads (one `.md` per session, each with a metadata header — session ID / creation time / turn count — and timestamps). The ZIP also bundles:
- `index.html` — a self-contained offline viewer (double-click to open, works over `file://`): the sidebar is a date-grouped timeline with sticky day headers, each session entry carries a first-question preview (clamped to two lines), and a stats bar sums up session count / total turns / time span; instant full-text search across titles, previews, and bodies (press `/` to focus, hit highlighting, no-match hint), rendered view with role badges / raw Markdown toggle, one-click copy and per-session `.md` download, with automatic light/dark theming;
- `manifest.json` — a machine-readable index (version 2): `id → file` mapping, turn counts, per-session `preview` fields and a global `stats` block (sessions / total turns / time span), and the export time, for scripts and external tooling.

## How it works

- Single-session paths (Markdown / PDF / long image / turn selection) live entirely in the browser bundle (`lib/client.js`), mounted by the stock loader with zero core changes. Batch export needs cross-session reads — the browser cannot reach transcripts beyond the current conversation — so the host half (`lib/index.js`) gains a **read-only service layer**: it mounts the `/conv-export` prefix routes (`GET /sessions`, `POST /batch`) via `ctx.webServer` and reads sessions via `ctx.sessionQuery`, packing them into a Markdown ZIP (zero-dependency packer, STORE method). No storage domain, no outbound network requests, no state; the batch selection panel (filter / checkboxes / select-all / count / cancel) stays plain DOM and shares the turn panel's skeleton and design tokens.
- Extraction walks `[data-conversation-scroll]` in document order, pairing user rows (`[class*="_userRow"]` bubbles) with assistant markdown containers (`[class*="_markdown_"]`) — the stock renderer's stable class contracts.
- The long-image/PDF paths use tiled rasterization: an offscreen stage stays mounted as the clone source, and each tile serializes a clean clone (explicit XHTML namespace, no offscreen offsets, `translateY(−offset)` window displacement) into an SVG `foreignObject`, validates it with `DOMParser`, then rasterizes onto an independent 2x canvas (tile height = A4 page height × 2). External images are fetched and inlined first; unreachable ones are dropped rather than tainting the canvas. PNG rows stream through a tile-level adaptive filter into `CompressionStream('deflate')` incremental compression — exactly the zlib stream the PNG spec requires.

## Known limitations

- The long-image and PDF paths rasterize through SVG `foreignObject` (all evergreen browsers paint it); exotic embedded content may flatten.
- PDF pages are raster images (text is not selectable); for selectable text use the Markdown or HTML export (the latter also prints to a selectable-text PDF from the browser).
- Export scope is the active conversation column only — sidebar titles and settings pages are out of scope.
- Batch export is Markdown-only (PDF / long images require per-session client-side rasterization and can't join a ZIP); batch entries are derived from session logs (raw text + metadata header), not reverse-serialized from rendered HTML, so rich-text formatting follows the log source.

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
