// Keep in sync with backend/apps/books/constants.py
export const WORDS_PER_PAGE = 300;
export const MAX_BOOK_BYTES = 50 * 1024 * 1024;
export const HEARTBEAT_MS = 15_000;
export const IDLE_MS = 60_000;
export const ACCEPTED_BOOK_TYPES = '.pdf,.epub,.txt';

const BULLET_RE = /^([•●▪‣*–-]|[0-9]+[.)])\s+/;

/**
 * Paginate by word count while keeping original newlines/spacing so headings
 * and lists still render as blocks inside each virtual page.
 */
export function paginateText(text, wordsPerPage = WORDS_PER_PAGE) {
	const source = (text || '').trim();
	if (!source) return [''];
	const tokens = source.split(/(\s+)/);
	const pages = [];
	let wordIndex = 0;
	let buf = [];
	for (const token of tokens) {
		if (!token) continue;
		if (token.trim()) {
			if (wordIndex > 0 && wordIndex % wordsPerPage === 0) {
				pages.push(buf.join('').trim());
				buf = [];
			}
			buf.push(token);
			wordIndex += 1;
		} else if (buf.length) {
			buf.push(token);
		}
	}
	const last = buf.join('').trim();
	if (last || !pages.length) pages.push(last);
	return pages;
}

function isHeading(line) {
	if (/^#{1,6}\s+\S/.test(line)) return true;
	if (line.length > 70) return false;
	if (/[.,;]$/.test(line)) return false;
	if (/\.$/.test(line)) return false;
	if (!/^[A-Z“"']/.test(line)) return false;
	const words = line.replace(/[?!]$/, '').split(/\s+/).filter(Boolean);
	return words.length >= 2 && words.length <= 10;
}

function headingText(line) {
	return line.replace(/^#{1,6}\s+/, '');
}

function bulletText(line) {
	return line.replace(BULLET_RE, '');
}

/** Turn a virtual page into headings, paragraphs, and lists for the reader. */
export function pageBlocks(text) {
	const raw = (text || '').trim().replace(/^[•●▪‣*–-]\s*$/gm, '');
	if (!raw) return [];
	if (!/\n/.test(raw)) {
		return [{ type: 'p', text: raw }];
	}

	const blocks = [];
	const chunks = raw.split(/\n{2,}/);
	for (const chunk of chunks) {
		const lines = chunk
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
		if (!lines.length) continue;

		if (lines.every((line) => BULLET_RE.test(line))) {
			blocks.push({ type: 'ul', items: lines.map(bulletText) });
			continue;
		}

		if (lines.length === 1 && isHeading(lines[0])) {
			blocks.push({ type: 'h', text: headingText(lines[0]) });
			continue;
		}

		let para = [];
		const flushPara = () => {
			if (!para.length) return;
			blocks.push({ type: 'p', text: para.join(' ') });
			para = [];
		};
		for (const line of lines) {
			if (BULLET_RE.test(line)) {
				flushPara();
				const last = blocks[blocks.length - 1];
				if (last?.type === 'ul') last.items.push(bulletText(line));
				else blocks.push({ type: 'ul', items: [bulletText(line)] });
			} else if (/^#{1,6}\s+\S/.test(line)) {
				flushPara();
				blocks.push({ type: 'h', text: headingText(line) });
			} else {
				para.push(line);
			}
		}
		flushPara();
	}
	return blocks;
}

export function formatLabel(fmt) {
	if (fmt === 'pdf') return 'PDF';
	if (fmt === 'epub') return 'EPUB';
	if (fmt === 'txt') return 'TXT';
	return fmt || '—';
}

export function countWords(text) {
	return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function blockWordCount(block) {
	if (!block) return 0;
	if (block.type === 'ul') {
		return (block.items || []).reduce((n, item) => n + countWords(item), 0);
	}
	return countWords(block.text);
}

function pageWordCount(page) {
	if (typeof page === 'string') return countWords(page);
	if (!Array.isArray(page)) return 0;
	return page.reduce((n, block) => n + blockWordCount(block), 0);
}

export function wordOffsetAtPage(pages, pageNumber) {
	let offset = 0;
	const last = Math.min(Math.max(pageNumber, 1), pages.length) - 1;
	for (let i = 0; i < last; i += 1) offset += pageWordCount(pages[i]);
	return offset;
}

export function pageIndexForWordOffset(pages, offset) {
	let n = 0;
	for (let i = 0; i < pages.length; i += 1) {
		n += pageWordCount(pages[i]);
		if (offset < n) return i;
	}
	return Math.max(0, pages.length - 1);
}

/** Map a fitted visual page onto the stored 300-word page_count for heartbeats. */
export function backendPageFromVisual(pages, visualPage, pageCount) {
	const total = Math.max(1, intOr(pageCount, 1));
	const read = wordOffsetAtPage(pages, visualPage) + pageWordCount(pages[visualPage - 1] || []);
	if (read <= 0) return 1;
	return Math.min(total, Math.max(1, Math.ceil(read / WORDS_PER_PAGE)));
}

function intOr(value, fallback) {
	const n = Number(value);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function makeMeasureNode(width) {
	const el = document.createElement('div');
	el.className = 'reader-prose';
	el.setAttribute('aria-hidden', 'true');
	el.style.cssText = [
		'position:absolute',
		'left:-10000px',
		'top:0',
		`width:${Math.max(40, width)}px`,
		'visibility:hidden',
		'pointer-events:none',
		'z-index:-1'
	].join(';');
	document.body.appendChild(el);
	return el;
}

function blocksToHtml(blocks) {
	return blocks
		.map((block) => {
			if (block.type === 'h') return `<h2>${escapeHtml(block.text)}</h2>`;
			if (block.type === 'ul') {
				const items = block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
				return `<ul>${items}</ul>`;
			}
			return `<p>${escapeHtml(block.text)}</p>`;
		})
		.join('');
}

function heightOf(measure, blocks, maxH) {
	measure.innerHTML = blocksToHtml(blocks);
	return measure.scrollHeight <= maxH + 1;
}

function splitWords(text) {
	return (text || '').trim().split(/\s+/).filter(Boolean);
}

function cutAtSentence(words, maxN) {
	if (maxN >= words.length) return words.length;
	const floor = Math.max(1, Math.ceil(maxN * 0.6));
	for (let i = maxN - 1; i >= floor; i -= 1) {
		if (/[.!?]["”']?$/.test(words[i])) return i + 1;
	}
	return maxN;
}

function wordsThatFit(measure, prefix, type, words, maxH) {
	if (!words.length) return 0;
	const asBlock = (n) => ({ type, text: words.slice(0, n).join(' ') });
	const fitsN = (n) => heightOf(measure, [...prefix, asBlock(n)], maxH);
	if (!fitsN(1)) return 0;
	let lo = 1;
	let hi = words.length;
	let best = 1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (fitsN(mid)) {
			best = mid;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}
	return best;
}

function splitParagraph(measure, prefix, text, maxH) {
	const words = splitWords(text);
	if (!words.length) return { fit: null, rest: null };
	let n = wordsThatFit(measure, prefix, 'p', words, maxH);
	if (n <= 0) {
		if (!prefix.length && words.length) {
			return {
				fit: { type: 'p', text: words[0] },
				rest: words.length > 1 ? { type: 'p', text: words.slice(1).join(' ') } : null
			};
		}
		return { fit: null, rest: { type: 'p', text } };
	}
	if (n < words.length) n = cutAtSentence(words, n);
	if (n <= 0) n = 1;
	const fit = { type: 'p', text: words.slice(0, n).join(' ') };
	const restText = words.slice(n).join(' ');
	return { fit, rest: restText ? { type: 'p', text: restText } : null };
}

function splitList(measure, prefix, block, maxH) {
	const fitItems = [];
	let restItems = [...(block.items || [])];
	while (restItems.length) {
		const candidate = { type: 'ul', items: [...fitItems, restItems[0]] };
		if (heightOf(measure, [...prefix, candidate], maxH)) {
			fitItems.push(restItems.shift());
			continue;
		}
		if (!fitItems.length) {
			const words = splitWords(restItems[0]);
			const n = wordsThatFit(measure, prefix, 'p', words, maxH);
			if (n > 0 && n < words.length) {
				fitItems.push(words.slice(0, n).join(' '));
				restItems[0] = words.slice(n).join(' ');
			} else if (n >= words.length) {
				fitItems.push(restItems.shift());
			}
		}
		break;
	}
	return {
		fit: fitItems.length ? { type: 'ul', items: fitItems } : null,
		rest: restItems.length ? { type: 'ul', items: restItems } : null
	};
}

/**
 * Pack parsed blocks into pages that fit width×height.
 * Headings stay intact; paragraphs split as body text (never re-detected as titles).
 */
export function paginateToFit(text, { width, height }) {
	const blocks = pageBlocks(text);
	if (!blocks.length) return [[]];
	if (typeof document === 'undefined') return [blocks];

	const maxH = Math.max(40, height - 2);
	const measure = makeMeasureNode(width);
	const pages = [];
	let current = [];

	const flush = () => {
		if (!current.length) return;
		pages.push(current);
		current = [];
	};

	const place = (block) => {
		if (heightOf(measure, [...current, block], maxH)) {
			current = [...current, block];
			return true;
		}
		return false;
	};

	for (const block of blocks) {
		if (place(block)) continue;

		if (block.type === 'h') {
			flush();
			if (!place(block)) {
				pages.push([block]);
				current = [];
			}
			continue;
		}

		const split =
			block.type === 'ul'
				? splitList(measure, current, block, maxH)
				: splitParagraph(measure, current, block.text, maxH);

		if (split.fit) current = [...current, split.fit];
		flush();

		let rest = split.rest;
		while (rest) {
			if (place(rest)) {
				rest = null;
				break;
			}
			const again =
				rest.type === 'ul'
					? splitList(measure, [], rest, maxH)
					: splitParagraph(measure, [], rest.text, maxH);
			if (again.fit) pages.push([again.fit]);
			if (!again.rest || again.rest === rest) {
				if (again.rest && !again.fit) pages.push([again.rest]);
				rest = null;
				break;
			}
			rest = again.rest;
		}
	}
	flush();
	measure.remove();
	return pages.length ? pages : [[]];
}
