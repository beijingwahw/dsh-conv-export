window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-conv-export",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		//#region src/client/extract.ts
		/**
		* Conversation extraction: walks the rendered transcript and produces a
		* role-ordered message list the exporters (Markdown / PDF / long image)
		* share.
		*
		* Selectors come from the stock web app's rendered DOM (verified against a
		* live session): user turns hang under a row whose CSS-module class ends in
		* `_userRow` (bubble text inside `[class*="_bubble"]`); assistant turns are
		* rendered markdown under `[class*="_markdown_"]`. Class names are
		* hash-prefixed (`gdEzaW_userRow`), so attribute-contains matching is the
		* stable contract.
		*
		* No cordis, no React — pure DOM helpers, unit-testable against jsdom.
		*/
		/** Selector of the conversation scrollport the extractor operates within. */
		const SCROLL_SELECTOR = "[data-conversation-scroll]";
		/** Selector matching a user turn row. */
		const USER_ROW_SELECTOR = "[class*=\"_userRow\"]";
		/** Selector matching an assistant turn's rendered markdown container. */
		const ASSISTANT_MD_SELECTOR = "[class*=\"_markdown_\"]";
		/** Selector of the header breadcrumb segment carrying the session title. */
		const TITLE_SELECTOR = "[class*=\"crumbSeg\"]";
		/**
		* Resolve the conversation scrollport from anywhere in the document.
		* @param from - any element or the document itself.
		* @returns the scrollport element, or null when no conversation is rendered.
		*/
		function resolveScope(from = document) {
			return from.querySelector(SCROLL_SELECTOR);
		}
		/**
		* Read the session title from the header breadcrumb.
		* @returns the trimmed title, or null when absent.
		*/
		function readTitle() {
			const text = document.querySelector(TITLE_SELECTOR)?.textContent?.trim();
			return text === "" || text === void 0 ? null : text ?? null;
		}
		/**
		* Extract every rendered turn in document order. User rows and assistant
		* markdown containers are collected with one combined querySelectorAll,
		* which returns document order — so the interleaving is exactly what the
		* reader sees.
		* @param scope - the conversation scrollport (defaults to resolving one).
		* @returns the ordered turns; empty when nothing is rendered.
		*/
		function extractMessages(scope) {
			const port = scope ?? resolveScope();
			if (port === null) return [];
			const nodes = port.querySelectorAll(`${USER_ROW_SELECTOR}, ${ASSISTANT_MD_SELECTOR}`);
			const out = [];
			for (const node of nodes) if (node.matches("[class*=\"_userRow\"]")) {
				const text = ((node.querySelector("[class*=\"_bubble\"]") ?? node).textContent ?? "").trim();
				if (text !== "") out.push({
					role: "user",
					text,
					html: ""
				});
			} else {
				const text = (node.textContent ?? "").trim();
				if (text !== "") out.push({
					role: "assistant",
					text,
					html: node.innerHTML
				});
			}
			return out;
		}
		/**
		* Sanitize a string into a safe download-file stem: path/hostile characters
		* and runs of whitespace collapse to '-', capped at 60 chars.
		* @param raw - the proposed file name stem (e.g. the session title).
		* @returns the sanitized stem (never empty).
		*/
		function safeFileStem(raw) {
			const cleaned = raw.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
			return cleaned === "" ? "conversation" : cleaned;
		}
		//#endregion
		//#region src/client/i18n.ts
		/**
		* Tiny self-contained i18n for the export menu. The menu renders outside the
		* slot render tree (fixed overlay), so it carries its own dictionaries and
		* picks the language from the document/navigator instead of the locale
		* service — zero extra service dependencies.
		*/
		/** Simplified Chinese dictionary (key-set source of truth). */
		const zh = {
			"action.label": "对话导出",
			"action.aria": "导出当前对话 (Markdown / PDF / 长图)",
			"action.hint": "导出当前对话",
			"menu.markdown": "Markdown (.md)",
			"menu.pdf": "PDF (下载)",
			"menu.image": "长图 (PNG)",
			"role.user": "用户",
			"role.assistant": "助手",
			"toast.imageFail": "长图生成失败，请改用 Markdown 或 PDF"
		};
		/** English dictionary, complete against the zh key set. */
		const en = {
			"action.label": "Export conversation",
			"action.aria": "Export this conversation (Markdown / PDF / long image)",
			"action.hint": "Export this conversation",
			"menu.markdown": "Markdown (.md)",
			"menu.pdf": "PDF (download)",
			"menu.image": "Long image (PNG)",
			"role.user": "User",
			"role.assistant": "Assistant",
			"toast.imageFail": "Long-image render failed — use Markdown or PDF instead"
		};
		/**
		* Detect the UI language once: the document lang attribute wins, then the
		* navigator; anything Chinese-prefixed maps to zh, everything else to en.
		* @returns the active dictionary.
		*/
		function detectDict() {
			return (document.documentElement.lang || navigator.language || "en").toLowerCase().startsWith("zh") ? zh : en;
		}
		let active;
		/**
		* Translate one key.
		* @param key - dictionary key.
		* @returns the localized text.
		*/
		function t(key) {
			active ??= detectDict();
			return active[key];
		}
		//#endregion
		//#region src/client/markdown.ts
		/**
		* Serialize one inline subtree (no block structure) into markdown text.
		* @param node - the inline root.
		* @returns the inline markdown.
		*/
		function inline(node) {
			if (node.nodeType === Node.TEXT_NODE) return (node.nodeValue ?? "").replace(/\s+/g, " ");
			if (node.nodeType !== Node.ELEMENT_NODE) return "";
			const el = node;
			const kids = () => Array.from(el.childNodes).map(inline).join("");
			switch (el.tagName) {
				case "STRONG":
				case "B": {
					const text = kids().trim();
					return text === "" ? "" : `**${text}**`;
				}
				case "EM":
				case "I": {
					const text = kids().trim();
					return text === "" ? "" : `*${text}*`;
				}
				case "DEL":
				case "S": {
					const text = kids().trim();
					return text === "" ? "" : `~~${text}~~`;
				}
				case "CODE": {
					const text = (el.textContent ?? "").trim();
					return text === "" ? "" : `\`${text}\``;
				}
				case "A": {
					const text = kids().trim();
					const href = el.getAttribute("href") ?? "";
					if (text === "" || href === "") return text;
					return `[${text}](${href})`;
				}
				case "BR": return "\n";
				case "IMG": {
					const alt = el.getAttribute("alt") ?? "";
					const src = el.getAttribute("src") ?? "";
					return src === "" ? alt : `![${alt}](${src})`;
				}
				default: return kids();
			}
		}
		/**
		* Serialize one list element (ul/ol) with nesting indentation.
		* @param el - the list element.
		* @param depth - nesting depth (0 = top level).
		* @returns the markdown list lines.
		*/
		function list(el, depth) {
			const ordered = el.tagName === "OL";
			const pad = "  ".repeat(depth);
			const lines = [];
			let n = 1;
			for (const li of Array.from(el.children).filter((c) => c.tagName === "LI")) {
				const bullet = ordered ? `${n}. ` : "- ";
				n += 1;
				const inlineParts = Array.from(li.childNodes).filter((c) => !(c.nodeType === Node.ELEMENT_NODE && c.tagName === "UL" || c.nodeType === Node.ELEMENT_NODE && c.tagName === "OL")).map(inline).join("");
				const nested = Array.from(li.children).filter((c) => c.tagName === "UL" || c.tagName === "OL").map((c) => list(c, depth + 1)).join("");
				lines.push(`${pad}${bullet}${inlineParts.trim()}${nested === "" ? "" : `\n${nested}`}`);
			}
			return lines.join("\n");
		}
		/**
		* Serialize a table into a GitHub-flavored markdown table.
		* @param el - the table element.
		* @returns the markdown table text.
		*/
		function table(el) {
			const rows = Array.from(el.querySelectorAll("tr"));
			if (rows.length === 0) return "";
			const cells = (tr) => Array.from(tr.querySelectorAll("th, td")).map((td) => inline(td).trim().replace(/\|/g, "\\|"));
			const out = [];
			rows.forEach((tr, i) => {
				out.push(`| ${cells(tr).join(" | ")} |`);
				if (i === 0) out.push(`| ${cells(tr).map(() => "---").join(" | ")} |`);
			});
			return out.join("\n");
		}
		/**
		* Serialize one block-level subtree into markdown.
		* @param node - the block root.
		* @returns the block markdown (blank-line separated).
		*/
		function block(node) {
			if (node.nodeType === Node.TEXT_NODE) {
				const text = (node.nodeValue ?? "").trim();
				return text === "" ? "" : text;
			}
			if (node.nodeType !== Node.ELEMENT_NODE) return "";
			const el = node;
			const kids = () => Array.from(el.childNodes).map(block).filter((s) => s !== "").join("\n\n");
			switch (el.tagName) {
				case "H1": return `# ${inline(el).trim()}`;
				case "H2": return `## ${inline(el).trim()}`;
				case "H3": return `### ${inline(el).trim()}`;
				case "H4": return `#### ${inline(el).trim()}`;
				case "H5": return `##### ${inline(el).trim()}`;
				case "H6": return `###### ${inline(el).trim()}`;
				case "PRE": {
					const code = el.querySelector("code");
					return `\`\`\`${(code?.getAttribute("class") ?? "").match(/language-([\w+-]+)/)?.[1] ?? ""}\n${(code?.textContent ?? el.textContent ?? "").replace(/\n$/, "")}\n\`\`\``;
				}
				case "UL":
				case "OL": return list(el, 0);
				case "BLOCKQUOTE": return kids().split("\n").map((l) => `> ${l}`).join("\n");
				case "HR": return "---";
				case "TABLE": return table(el);
				case "P":
				case "DIV":
				case "SECTION":
				case "ARTICLE": return kids();
				case "BR": return "";
				default: return el.children.length === 0 ? inline(el).trim() : kids();
			}
		}
		/**
		* Convert one assistant turn's rendered HTML back into markdown.
		* @param html - the markdown container's innerHTML.
		* @returns the serialized markdown (trimmed).
		*/
		function htmlToMarkdown(html) {
			const holder = document.createElement("div");
			holder.innerHTML = html;
			return Array.from(holder.childNodes).map(block).filter((s) => s !== "").join("\n\n").trim();
		}
		/**
		* Assemble the full export document.
		* @param title - the session title (null → generic heading).
		* @param messages - the extracted turns, in order.
		* @returns the markdown document text.
		*/
		function buildMarkdown(title, messages) {
			const parts = [];
			parts.push(`# ${title ?? "Conversation"}`);
			for (const msg of messages) {
				parts.push(`### ${msg.role === "user" ? t("role.user") : t("role.assistant")}`);
				parts.push(msg.role === "user" ? msg.text : htmlToMarkdown(msg.html));
			}
			return `${parts.join("\n\n")}\n`;
		}
		//#endregion
		//#region src/client/exporters.ts
		/** Raster width of the export raster (CSS px; doubled for retina). */
		const IMAGE_WIDTH = 800;
		/** Raster scale factor (2x retina). */
		const IMAGE_SCALE = 2;
		/** Upper bound for the raster height (canvas limits). */
		const IMAGE_MAX_HEIGHT = 16e3;
		/** One PDF page's height in CSS px at IMAGE_WIDTH (A4 aspect ratio). */
		const PAGE_CSS_HEIGHT = Math.round(IMAGE_WIDTH * 297 / 210);
		/** The shared export stylesheet for the raster and the PDF pages. */
		const EXPORT_CSS = `
  body { font: 14px/1.7 -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
         color: #1f2328; background: #fff; margin: 0; }
  .x-wrap { max-width: 720px; margin: 0 auto; padding: 32px 24px; }
  .x-title { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
  .x-turn { margin: 0 0 20px; }
  .x-role { font-size: 12px; font-weight: 600; color: #4b5563; margin: 0 0 6px; }
  .x-user { background: #f3f4f6; border-radius: 10px; padding: 10px 14px; white-space: pre-wrap; }
  .x-md pre { background: #f6f8fa; border: 1px solid #e5e7eb; border-radius: 8px;
              padding: 10px 12px; overflow-x: auto; font-size: 12.5px; line-height: 1.55; }
  .x-md code { font-family: ui-monospace, 'Cascadia Code', Consolas, monospace; font-size: .92em; }
  .x-md pre code { background: none; }
  .x-md :not(pre) > code { background: #f3f4f6; border-radius: 4px; padding: 1px 5px; }
  .x-md h1, .x-md h2, .x-md h3 { line-height: 1.35; margin: 18px 0 8px; }
  .x-md h1 { font-size: 19px; } .x-md h2 { font-size: 17px; } .x-md h3 { font-size: 15px; }
  .x-md ul, .x-md ol { padding-left: 22px; margin: 8px 0; }
  .x-md blockquote { border-left: 3px solid #d1d5db; margin: 8px 0; padding: 2px 12px; color: #4b5563; }
  .x-md table { border-collapse: collapse; } .x-md td, .x-md th { border: 1px solid #e5e7eb; padding: 4px 10px; }
`;
		/**
		* Trigger a client-side file download.
		* @param filename - the download file name.
		* @param mime - the blob MIME type.
		* @param data - the blob body.
		*/
		function downloadBlob(filename, mime, data) {
			const blob = new Blob([data], { type: mime });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => {
				URL.revokeObjectURL(url);
			}, 4e3);
		}
		/**
		* Build the export body HTML (shared by the PDF pages and the long image).
		* @param title - the session title.
		* @param messages - the extracted turns.
		* @returns the body markup string.
		*/
		function buildExportHtml(title, messages) {
			const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
			const turns = messages.map((m) => m.role === "user" ? `<div class="x-turn"><p class="x-role">${esc(t("role.user"))}</p><div class="x-user">${esc(m.text)}</div></div>` : `<div class="x-turn"><p class="x-role">${esc(t("role.assistant"))}</p><div class="x-md">${m.html}</div></div>`).join("");
			return `<div class="x-wrap"><h1 class="x-title">${esc(title)}</h1>${turns}</div>`;
		}
		/**
		* Inline every <img> in a container as a data: URL so the SVG foreignObject
		* raster can embed them (external fetches are forbidden inside an SVG image).
		* @param root - the container whose images are inlined in place.
		*/
		async function inlineImages(root) {
			const imgs = Array.from(root.querySelectorAll("img"));
			await Promise.all(imgs.map(async (img) => {
				const src = img.getAttribute("src") ?? "";
				if (src === "" || src.startsWith("data:")) return;
				try {
					const res = await fetch(src);
					if (!res.ok) return;
					const blob = await res.blob();
					const dataUrl = await new Promise((resolve, reject) => {
						const reader = new FileReader();
						reader.onload = () => {
							resolve(String(reader.result));
						};
						reader.onerror = () => {
							reject(reader.error);
						};
						reader.readAsDataURL(blob);
					});
					img.setAttribute("src", dataUrl);
				} catch {
					img.remove();
				}
			}));
		}
		/**
		* Render the export document offscreen and rasterize it onto a 2x canvas.
		* @param title - the session title.
		* @param messages - the extracted turns.
		* @returns the rasterized canvas (IMAGE_WIDTH * IMAGE_SCALE wide).
		* @throws when the runtime cannot rasterize.
		*/
		async function rasterize(title, messages) {
			const stage = document.createElement("div");
			stage.style.cssText = `position:fixed;left:-100000px;top:0;width:${IMAGE_WIDTH}px;pointer-events:none;z-index:-1;`;
			stage.innerHTML = buildExportHtml(title, messages);
			const style = document.createElement("style");
			style.textContent = EXPORT_CSS;
			stage.prepend(style);
			document.body.appendChild(stage);
			try {
				await inlineImages(stage);
				await new Promise((resolve) => {
					setTimeout(resolve, 60);
				});
				const height = Math.min(Math.ceil(stage.scrollHeight), IMAGE_MAX_HEIGHT);
				const clone = stage.cloneNode(true);
				clone.style.cssText = `width:${IMAGE_WIDTH}px;background:#ffffff;`;
				clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
				const serialized = new XMLSerializer().serializeToString(clone);
				const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;
				if (new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("parsererror") !== null) throw new Error("svg serialize failed");
				const img = new Image();
				img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
				await img.decode();
				const canvas = document.createElement("canvas");
				canvas.width = IMAGE_WIDTH * IMAGE_SCALE;
				canvas.height = height * IMAGE_SCALE;
				const ctx = canvas.getContext("2d");
				if (ctx === null) throw new Error("no 2d context");
				ctx.scale(IMAGE_SCALE, IMAGE_SCALE);
				ctx.fillStyle = "#ffffff";
				ctx.fillRect(0, 0, IMAGE_WIDTH, height);
				ctx.drawImage(img, 0, 0, IMAGE_WIDTH, height);
				return canvas;
			} finally {
				stage.remove();
			}
		}
		/**
		* Assemble a minimal multi-page PDF, one JPEG per page.
		* @param pages - the page payloads in order.
		* @returns the PDF file bytes.
		*/
		function buildPdf(pages) {
			const enc = new TextEncoder();
			const chunks = [];
			let offset = 0;
			const offsets = [];
			const push = (data) => {
				const bytes = typeof data === "string" ? enc.encode(data) : data;
				chunks.push(bytes);
				offset += bytes.length;
			};
			const beginObj = (num) => {
				offsets[num] = offset;
				push(`${num} 0 obj\n`);
			};
			const endObj = () => {
				push("endobj\n");
			};
			const count = pages.length;
			push("%PDF-1.4\n");
			beginObj(1);
			push("<< /Type /Catalog /Pages 2 0 R >>\n");
			endObj();
			beginObj(2);
			push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] /Count ${count} >>\n`);
			endObj();
			pages.forEach((page, i) => {
				const pageNum = 3 + i * 3;
				const imgNum = pageNum + 1;
				const contentNum = pageNum + 2;
				const wPt = (page.widthPx * .75).toFixed(2);
				const hPt = (page.heightPx * .75).toFixed(2);
				beginObj(pageNum);
				push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /XObject << /Im0 ${imgNum} 0 R >> >> /Contents ${contentNum} 0 R >>\n`);
				endObj();
				beginObj(imgNum);
				push(`<< /Type /XObject /Subtype /Image /Width ${page.widthPx * IMAGE_SCALE} /Height ${page.heightPx * IMAGE_SCALE} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`);
				push(page.jpeg);
				push("\nendstream\n");
				endObj();
				const stream = `q\n${wPt} 0 0 ${hPt} 0 0 cm\n/Im0 Do\nQ\n`;
				beginObj(contentNum);
				push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream\n`);
				endObj();
			});
			const total = 2 + count * 3;
			const xrefAt = offset;
			push(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
			for (let n = 1; n <= total; n += 1) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
			push(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);
			const out = new Uint8Array(offset);
			let at = 0;
			for (const chunk of chunks) {
				out.set(chunk, at);
				at += chunk.length;
			}
			return out;
		}
		/**
		* Export as PDF: rasterize the conversation, slice it into page-height
		* strips, and download a self-contained multi-page PDF. No print dialog —
		* the app tab never freezes.
		* @param title - the session title (also the file stem, sanitized).
		* @param messages - the extracted turns.
		* @throws when the runtime cannot rasterize.
		*/
		async function exportPdf(title, messages) {
			const canvas = await rasterize(title, messages);
			const slicePx = PAGE_CSS_HEIGHT * IMAGE_SCALE;
			const pages = [];
			for (let y = 0; y < canvas.height; y += slicePx) {
				const h = Math.min(slicePx, canvas.height - y);
				const slice = document.createElement("canvas");
				slice.width = canvas.width;
				slice.height = h;
				const ctx = slice.getContext("2d");
				if (ctx === null) throw new Error("no 2d context");
				ctx.fillStyle = "#ffffff";
				ctx.fillRect(0, 0, slice.width, h);
				ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
				const jpeg = await new Promise((resolve) => {
					slice.toBlob(resolve, "image/jpeg", .92);
				});
				if (jpeg === null) throw new Error("toBlob failed");
				pages.push({
					jpeg: new Uint8Array(await jpeg.arrayBuffer()),
					widthPx: IMAGE_WIDTH,
					heightPx: Math.ceil(h / IMAGE_SCALE)
				});
			}
			downloadBlob(`${safeFileStem(title)}.pdf`, "application/pdf", buildPdf(pages));
		}
		/**
		* Export as a long PNG: rasterize the whole conversation and download one
		* tall image.
		* @param title - the session title (also the file stem, sanitized).
		* @param messages - the extracted turns.
		* @throws when the runtime cannot rasterize (no canvas / SVG parse failure).
		*/
		async function exportImage(title, messages) {
			const canvas = await rasterize(title, messages);
			const blob = await new Promise((resolve) => {
				canvas.toBlob(resolve, "image/png");
			});
			if (blob === null) throw new Error("toBlob failed");
			downloadBlob(`${safeFileStem(title)}.png`, "image/png", blob);
		}
		//#endregion
		//#region src/client/controller.ts
		/**
		* The export controller: owns the header-triggered dropdown menu (plain DOM
		* — no React, so it never couples to the shell's React version) and
		* dispatches the three sinks (Markdown download, PDF print window, long
		* PNG). Extraction runs at click time, so the export always reflects the
		* transcript exactly as the reader sees it.
		*
		* Lifecycle: `install()` from the cordis apply (menu mount + outside-click
		* close), `uninstall()` on plugin unload.
		*/
		/**
		* The singleton controller. A page hosts exactly one conversation pane, so
		* a module-level instance is the right ownership; cordis install/uninstall
		* bracket its DOM effects.
		*/
		var ExportController = class {
			menu = null;
			installed = false;
			busy = false;
			/** Install the menu DOM and document listeners. Idempotent. */
			install() {
				if (this.installed) return;
				this.installed = true;
				this.mountMenu();
				document.addEventListener("pointerdown", this.onOutside, true);
				document.addEventListener("keydown", this.onKeyDown, true);
			}
			/** Remove every installed effect. Idempotent. */
			uninstall() {
				if (!this.installed) return;
				this.installed = false;
				document.removeEventListener("pointerdown", this.onOutside, true);
				document.removeEventListener("keydown", this.onKeyDown, true);
				this.menu?.remove();
				this.menu = null;
			}
			/**
			* Toggle the dropdown (the header action button's gesture), anchoring it
			* under the triggering button.
			* @param anchor - the header action button (positions the menu).
			*/
			toggle(anchor) {
				if (this.menu === null) return;
				if (resolveScope() === null) return;
				const open = this.menu.hidden !== false;
				this.menu.hidden = !open;
				if (open && anchor instanceof HTMLElement) {
					const rect = anchor.getBoundingClientRect();
					const width = this.menu.offsetWidth;
					const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
					this.menu.style.top = `${Math.round(rect.bottom + 6)}px`;
					this.menu.style.left = `${Math.round(left)}px`;
				}
				this.syncActionButton(open);
			}
			/** Close the dropdown. */
			close() {
				if (this.menu === null || this.menu.hidden) return;
				this.menu.hidden = true;
				this.syncActionButton(false);
			}
			/** Build the dropdown once and hide it until opened. */
			mountMenu() {
				const menu = document.createElement("div");
				menu.setAttribute("data-dsh-conv-export-menu", "");
				menu.hidden = true;
				menu.setAttribute("role", "menu");
				const entries = [
					{
						kind: "markdown",
						label: t("menu.markdown")
					},
					{
						kind: "pdf",
						label: t("menu.pdf")
					},
					{
						kind: "image",
						label: t("menu.image")
					}
				];
				for (const entry of entries) {
					const btn = document.createElement("button");
					btn.type = "button";
					btn.setAttribute("role", "menuitem");
					btn.setAttribute("data-export-kind", entry.kind);
					btn.textContent = entry.label;
					btn.addEventListener("click", () => {
						this.run(entry.kind);
					});
					menu.appendChild(btn);
				}
				document.body.appendChild(menu);
				this.menu = menu;
			}
			/** Mirror the open state onto the header action button. */
			syncActionButton(open) {
				const btn = document.querySelector(".dsh-conv-export-action");
				if (btn === null) return;
				btn.setAttribute("aria-pressed", String(open));
			}
			/** Close on any pointer-down outside the menu and its action button. */
			onOutside = (e) => {
				if (this.menu === null || this.menu.hidden) return;
				const target = e.target;
				if (!(target instanceof Node)) return;
				if (this.menu.contains(target)) return;
				if (target instanceof Element && target.closest(".dsh-conv-export-action") !== null) return;
				this.close();
			};
			/** Escape closes the menu. */
			onKeyDown = (e) => {
				if (e.key === "Escape") this.close();
			};
			/**
			* Run one export sink against the currently rendered transcript.
			* @param kind - which sink to run.
			*/
			async run(kind) {
				if (this.busy) return;
				const messages = extractMessages();
				if (messages.length === 0) return;
				const title = readTitle() ?? "Conversation";
				const stem = safeFileStem(title);
				this.busy = true;
				try {
					if (kind === "markdown") downloadBlob(`${stem}.md`, "text/markdown;charset=utf-8", buildMarkdown(title, messages));
					else if (kind === "pdf") await exportPdf(title, messages);
					else await exportImage(title, messages);
				} catch {
					this.toast(t("toast.imageFail"));
				} finally {
					this.busy = false;
					this.close();
				}
			}
			/**
			* Show a transient toast (bottom-center) for export failures.
			* @param text - the message to show.
			*/
			toast(text) {
				const el = document.createElement("div");
				el.setAttribute("data-dsh-conv-export-toast", "");
				el.textContent = text;
				document.body.appendChild(el);
				setTimeout(() => {
					el.remove();
				}, 3200);
			}
		};
		/** The page-wide controller instance. */
		const controller = new ExportController();
		//#endregion
		//#region src/client/styles.ts
		/**
		* Global stylesheet adoption: the export dropdown chrome, the header action
		* button, and the failure toast. Injected once into document.head with a
		* stable id so repeated plugin loads never double-inject.
		*/
		/** Stable id of the injected <style> element. */
		const STYLE_ID = "dsh-conv-export-style";
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
`;
		/**
		* Inject the stylesheet once. Safe to call from multiple mount paths.
		*/
		function adoptStyles() {
			if (document.getElementById(STYLE_ID) !== null) return;
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.textContent = STYLE_TEXT;
			document.head.appendChild(style);
		}
		//#endregion
		//#region src/client/index.ts
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
		/** Stable Cordis plugin name (matches the manifest id). */
		const name = "@dsh-external/dsh-conv-export";
		/** Required services: the slot registry (the header action seat rides it). */
		const inject = ["slots"];
		/**
		* The session-header export button: toggles the dropdown. Pure presentation
		* over the global controller.
		* @param _props - the slot's standard kit (unused).
		* @returns the icon button.
		*/
		function ExportActionButton(_props) {
			const icon = (0, react.createElement)("svg", {
				viewBox: "0 0 16 16",
				width: 16,
				height: 16,
				fill: "none",
				"aria-hidden": true
			}, (0, react.createElement)("path", {
				d: "M8 2v8m0 0 3-3M8 10 5 7",
				stroke: "currentColor",
				strokeWidth: 1.5,
				strokeLinecap: "round",
				strokeLinejoin: "round"
			}), (0, react.createElement)("path", {
				d: "M3 12.5v1A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-1",
				stroke: "currentColor",
				strokeWidth: 1.5,
				strokeLinecap: "round"
			}));
			return (0, react.createElement)("button", {
				type: "button",
				className: "dsh-conv-export-action",
				title: t("action.hint"),
				"aria-label": t("action.aria"),
				"aria-pressed": "false",
				onClick: (e) => {
					controller.toggle(e.currentTarget);
				}
			}, icon);
		}
		/**
		* Browser plugin body: install the controller's document effects and
		* register the header action button into the session header slot.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			adoptStyles();
			ctx.effect(() => {
				controller.install();
				return () => {
					controller.uninstall();
				};
			}, "dsh-conv-export: controller");
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "dsh-conv-export-action",
				order: 110,
				inject: () => ({})
			}, ExportActionButton));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
