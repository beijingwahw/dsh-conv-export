# dsh-conv-export（对话导出）

English | [中文](README.zh.md)

Export the current DeepSeek Harness conversation as **Markdown**, **PDF** (print dialog), or a **long PNG image** — one click in the session header, zero core changes.

## Problems it solves

- **Conversations evaporate**: long sessions hold decisions, code, and error trails, but the harness has no built-in way to take them out. This plugin turns the rendered transcript into portable artifacts.
- **One format never fits**: sharing with a teammate wants Markdown; archiving for compliance wants PDF; pasting into chat wants an image. All three ship in one menu.
- **Exports must match what you see**: extraction runs at click time over the rendered DOM (including paged-in history), so the artifact is exactly the transcript on screen — code fences, tables, and emphasis preserved.

## Features

- **Header export button** (download glyph) registered into the `conversation.session.header.actions` slot — additive, safely uninstalled, and mirrors its open state via `aria-pressed`.
- **Dropdown menu** with three sinks:
  - **Markdown (.md)** — client-side download; assistant turns are serialized back from rendered HTML (headings, lists, fenced code with language, tables, blockquotes, links, inline emphasis).
  - **PDF (download)** — the conversation is rasterized, sliced into A4-proportioned pages, and downloaded as a self-contained multi-page PDF. No print window, no dialog: the app tab never freezes.
  - **Long image (PNG)** — offscreen render measured and rasterized through SVG `foreignObject` at 2x, images inlined as data URLs, downloaded as one tall PNG (height capped at 16000px).
- **Sensible file names** from the session title (sanitized, capped).
- Follows the harness `--dsw-alias-*` design tokens; menu labels switch zh/en by document language.
- Menu hygiene: Escape or outside-click closes; a toast reports long-image raster failures.

## Install

Requires Node.js ≥ 22 and pnpm (`npm install -g pnpm`) — `dsh plugin add` installs the bundle into the profile with pnpm.

```sh
dsh plugin --profile web add https://github.com/beijingwahw/dsh-conv-export/archive/refs/heads/main.tar.gz
dsh web   # restart the server to pick the plugin up
```

## Usage

Open any conversation, click the download icon in the session header, pick a format. All three formats download directly — no dialogs, the app tab stays responsive.

## How it works

- The host half is an empty cordis registration shell; all behavior lives in the browser bundle (`lib/client.js`), mounted by the stock loader with zero core changes.
- Extraction walks `[data-conversation-scroll]` in document order, pairing user rows (`[class*="_userRow"]` bubbles) with assistant markdown containers (`[class*="_markdown_"]`) — the stock renderer's stable class contracts.
- The long-image path serializes a clean clone (explicit XHTML namespace, no offscreen offsets) into an SVG `foreignObject`, validates it with `DOMParser`, then rasterizes on a 2x canvas. External images are fetched and inlined first; unreachable ones are dropped rather than tainting the canvas.

## Known limitations

- The long-image and PDF paths rasterize through SVG `foreignObject` (all evergreen browsers paint it); exotic embedded content may flatten.
- PDF pages are raster images (text is not selectable); for selectable text use the Markdown export.
- Export scope is the active conversation column only — sidebar titles and settings pages are out of scope.

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
