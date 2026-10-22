import { WORDS_PER_PAGE, countWords } from './reading';

const IDENTITY_MAX = 255;
const AUTHOR_LINE_RE = /^(?:by|written by|authors?)\s*[:\-–—]?\s+(.+)$/i;
const BAD_TITLE_START_RE =
	/^(chapter|part|book|volume|contents|copyright|isbn|published|www\.|https?:\/\/)/i;
const NAME_PUNCT = new Set(['.', "'", '’', '-']);
const JUNK_TITLES = new Set([
	'untitled',
	'unknown',
	'unknown title',
	'title',
	'book',
	'document',
	'new document',
	'microsoft word',
	'adobe acrobat',
	'adobe acrobat pdf',
	'scan',
	'scanned',
	'scanned document',
	'image',
	'photo',
	'pdf',
	'epub',
	'text',
	'none',
	'n/a',
	'na',
	'null',
	'layout',
	'cover',
	'cover page',
	'title page',
	'page',
	'page 1',
	'chapter',
	'chapter 1',
	'contents',
	'table of contents',
	'copyright',
	'copyright page'
]);
const JUNK_AUTHORS = new Set([
	'unknown',
	'unknown author',
	'anonymous',
	'n/a',
	'na',
	'none',
	'null',
	'admin',
	'user',
	'author',
	'the author',
	'microsoft word',
	'adobe',
	'adobe acrobat',
	'writer',
	'google',
	'chrome',
	'mozilla',
	'preview'
]);
const BAD_AUTHOR_WORDS = new Set([
	'chapter',
	'contents',
	'copyright',
	'volume',
	'edition',
	'published',
	'publisher',
	'isbn',
	'introduction',
	'preface',
	'prologue',
	'foreword'
]);
const SKIP_EPUB_PARTS = ['nav', 'toc', 'ncx', 'copyright', 'colophon', 'dedication', 'acknowledg'];

export function formatFromName(name) {
	const ext = (name || '').split('.').pop()?.toLowerCase();
	if (ext === 'pdf' || ext === 'epub' || ext === 'txt') return ext;
	return '';
}

export function filenameStem(name) {
	const base = (name || '').split(/[/\\]/).pop() || '';
	return base.replace(/\.[^.]+$/, '') || 'Untitled';
}

function pagesFromWordCount(wordCount) {
	if (wordCount <= 0) return 1;
	return Math.max(1, Math.ceil(wordCount / WORDS_PER_PAGE));
}

function cleanSpace(value) {
	return String(value || '')
		.replace(/\u0000/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function clipIdentity(value) {
	const text = cleanSpace(value);
	if (text.length <= IDENTITY_MAX) return text;
	return `${text.slice(0, IDENTITY_MAX - 1).trimEnd()}…`;
}

function stripWrappingQuotes(text) {
	if (text.length >= 2 && text[0] === text.at(-1) && `"'“”‘’`.includes(text[0])) {
		return text.slice(1, -1).trim();
	}
	return text;
}

function isJunkTitle(title, filename) {
	const text = cleanSpace(title);
	if (!text) return true;
	const lowered = text.toLowerCase().replace(/^[\s._-]+|[\s._-]+$/g, '');
	if (JUNK_TITLES.has(lowered)) return true;
	if (
		lowered.startsWith('microsoft word') ||
		lowered.startsWith('adobe acrobat') ||
		lowered.startsWith('untitled')
	) {
		return true;
	}
	if (lowered.endsWith('.pdf') || lowered.endsWith('.epub') || lowered.endsWith('.txt')) {
		return true;
	}
	if (filename) {
		const stem = filenameStem(filename).toLowerCase();
		const name = (filename.split(/[/\\]/).pop() || '').toLowerCase();
		if (stem && lowered === stem) return true;
		if (name && lowered === name) return true;
	}
	return false;
}

function usableTitle(value, filename) {
	const text = stripWrappingQuotes(clipIdentity(value));
	return isJunkTitle(text, filename) ? '' : text;
}

function usableAuthor(value) {
	const text = stripWrappingQuotes(clipIdentity(value));
	if (!text) return '';
	const lowered = text.toLowerCase().replace(/^[\s.]+|[\s.]+$/g, '');
	if (JUNK_AUTHORS.has(lowered)) return '';
	if (lowered.startsWith('microsoft ') || lowered.startsWith('adobe ')) return '';
	return text;
}

function joinAuthors(values) {
	const seen = new Set();
	const names = [];
	for (const raw of values) {
		const text = usableAuthor(raw);
		if (!text) continue;
		const key = text.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		names.push(text);
	}
	return names.join(', ');
}

function looksLikeTitle(line) {
	const text = cleanSpace(line);
	if (text.length < 2 || text.length > 120) return false;
	if (isJunkTitle(text)) return false;
	if (BAD_TITLE_START_RE.test(text)) return false;
	if (/^[\divxlc]+$/i.test(text)) return false;
	if (text.endsWith('.') && text.split(/\s+/).length > 8) return false;
	return true;
}

function isNameToken(token) {
	if (!token) return false;
	let letters = 0;
	for (const char of token) {
		if (/\p{L}/u.test(char)) letters += 1;
		else if (!NAME_PUNCT.has(char)) return false;
	}
	return letters >= 1;
}

function looksLikeAuthorName(line) {
	const text = cleanSpace(line).replace(/^[\s.]+|[\s.]+$/g, '');
	if (!text || text.length > 80) return false;
	const parts = text
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
	if (!parts.length || parts.length > 6) return false;
	const tokens = parts.flatMap((part) => part.split(/\s+/).filter(Boolean));
	if (tokens.length < 1 || tokens.length > 12) return false;
	const lowered = new Set(tokens.map((token) => token.toLowerCase().replace(/\.$/, '')));
	for (const word of lowered) {
		if (BAD_AUTHOR_WORDS.has(word)) return false;
	}
	if (/\d/.test(text)) return false;
	const honorifics = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);
	const ok = tokens.filter(
		(token) => isNameToken(token) || honorifics.has(token.toLowerCase().replace(/\.$/, ''))
	).length;
	return ok >= Math.max(1, Math.floor(tokens.length * 0.7));
}

function authorFromLine(line) {
	const match = AUTHOR_LINE_RE.exec(cleanSpace(line));
	if (!match) return '';
	const candidate = match[1]
		.trim()
		.replace(/^[\s.]+|[\s.]+$/g, '')
		.replace(/\s+(?:and|&)\s+/g, ', ');
	if (!candidate || candidate.length > 80) return '';
	if (!looksLikeAuthorName(candidate)) return '';
	return usableAuthor(candidate);
}

function identityFromLines(lines, { forceFirstTitle = false } = {}) {
	let cleaned = (lines || []).map(cleanSpace).filter(Boolean).slice(0, 24);
	let title = '';
	let author = '';
	if (forceFirstTitle && cleaned.length) {
		const first = clipIdentity(stripWrappingQuotes(cleaned[0]));
		if (first && !isJunkTitle(first) && first.length <= 120) {
			title = first;
			cleaned = cleaned.slice(1);
		}
	}
	for (let index = 0; index < cleaned.length; index += 1) {
		const line = cleaned[index];
		const byAuthor = authorFromLine(line);
		if (byAuthor) {
			if (!author) author = byAuthor;
			if (title) break;
			continue;
		}
		if (!title && looksLikeTitle(line)) {
			title = clipIdentity(stripWrappingQuotes(line));
			continue;
		}
		if (title && !author && looksLikeAuthorName(line)) {
			author = usableAuthor(line);
			break;
		}
		if (title && index >= 2) break;
	}
	return { title, author };
}

function fallbackPreview(file) {
	return {
		title: filenameStem(file?.name) || 'Untitled',
		author: '',
		format: formatFromName(file?.name),
		pageCount: null,
		coverUrl: null
	};
}

function withIdentity(base, filename, title, author) {
	return {
		...base,
		title: title || base.title || filenameStem(filename) || 'Untitled',
		author: author || ''
	};
}

// -----------------------------------------------------------------------------
// ZIP (EPUB) reader — stored or deflate, using the central directory
// -----------------------------------------------------------------------------
function findZipKey(names, path) {
	const want = String(path || '')
		.replace(/\\/g, '/')
		.replace(/^\.\//, '');
	if (!want) return '';
	if (names.has(want)) return want;
	const lowered = want.toLowerCase();
	for (const name of names.keys()) {
		if (name.toLowerCase() === lowered) return name;
	}
	return '';
}

function resolveZipPath(baseFile, href) {
	if (!href) return '';
	const cleaned = href.split('#')[0].split('?')[0].replace(/\\/g, '/');
	if (!cleaned) return '';
	if (cleaned.startsWith('/')) return cleaned.slice(1);
	const base = baseFile.split('/').slice(0, -1);
	const parts = [...base, ...cleaned.split('/')];
	const out = [];
	for (const part of parts) {
		if (!part || part === '.') continue;
		if (part === '..') out.pop();
		else out.push(part);
	}
	return out.join('/');
}

async function inflateRaw(bytes) {
	const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

function parseZipEntries(buffer) {
	const u8 = new Uint8Array(buffer);
	const view = new DataView(buffer);
	let eocd = -1;
	const start = Math.max(0, u8.length - 65557);
	for (let i = u8.length - 22; i >= start; i -= 1) {
		if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 0x05 && u8[i + 3] === 0x06) {
			eocd = i;
			break;
		}
	}
	if (eocd < 0) throw new Error('Not a zip file.');
	const cdSize = view.getUint32(eocd + 12, true);
	const cdOffset = view.getUint32(eocd + 16, true);
	const entries = new Map();
	let pos = cdOffset;
	const end = Math.min(u8.length, cdOffset + cdSize);
	while (pos + 46 <= end) {
		if (view.getUint32(pos, true) !== 0x02014b50) break;
		const method = view.getUint16(pos + 10, true);
		const compSize = view.getUint32(pos + 20, true);
		const nameLen = view.getUint16(pos + 28, true);
		const extraLen = view.getUint16(pos + 30, true);
		const commentLen = view.getUint16(pos + 32, true);
		const localOff = view.getUint32(pos + 42, true);
		const nameBytes = u8.subarray(pos + 46, pos + 46 + nameLen);
		const name = new TextDecoder().decode(nameBytes).replace(/\\/g, '/');
		if (name && !name.endsWith('/')) {
			entries.set(name, { method, compSize, localOff });
		}
		pos += 46 + nameLen + extraLen + commentLen;
	}
	return entries;
}

async function readZipEntry(buffer, entry) {
	const view = new DataView(buffer);
	const u8 = new Uint8Array(buffer);
	if (!entry || entry.localOff + 30 > u8.length) return null;
	if (view.getUint32(entry.localOff, true) !== 0x04034b50) return null;
	const nameLen = view.getUint16(entry.localOff + 26, true);
	const extraLen = view.getUint16(entry.localOff + 28, true);
	const dataStart = entry.localOff + 30 + nameLen + extraLen;
	const dataEnd = dataStart + entry.compSize;
	if (dataEnd > u8.length) return null;
	const compressed = u8.subarray(dataStart, dataEnd);
	if (entry.method === 0) return compressed;
	if (entry.method === 8) return inflateRaw(compressed);
	return null;
}

async function openZip(buffer) {
	const entries = parseZipEntries(buffer);
	return {
		async get(path) {
			const key = findZipKey(entries, path);
			if (!key) return null;
			return readZipEntry(buffer, entries.get(key));
		},
		async text(path) {
			const bytes = await this.get(path);
			if (!bytes) return '';
			return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
		}
	};
}

function xmlAttr(el, name) {
	if (!el) return '';
	return el.getAttribute(name) || '';
}

function parseXml(text) {
	return new DOMParser().parseFromString(text || '', 'application/xml');
}

function elementsByLocalName(root, name) {
	if (!root?.getElementsByTagName) return [];
	return [...root.getElementsByTagName('*')].filter((el) => el.localName === name);
}

function htmlDoc(html) {
	return new DOMParser().parseFromString(html || '', 'text/html');
}

function htmlToText(html) {
	const doc = htmlDoc(html);
	doc.querySelectorAll('script,style').forEach((node) => node.remove());
	return (doc.body?.innerText || '').replace(/\s+\n/g, '\n').trim();
}

function firstHeading(html) {
	const el = htmlDoc(html).querySelector('h1,h2,h3');
	return cleanSpace(el?.textContent || '');
}

function shouldSkipEpubHref(href) {
	const name = (href || '').toLowerCase();
	return SKIP_EPUB_PARTS.some((part) => name.includes(part));
}

async function previewEpub(file) {
	const buffer = await file.arrayBuffer();
	const zip = await openZip(buffer);
	const container = await zip.text('META-INF/container.xml');
	const rootfile = elementsByLocalName(parseXml(container), 'rootfile')[0];
	const opfPath = xmlAttr(rootfile, 'full-path') || 'content.opf';
	const opfText = await zip.text(opfPath);
	const opf = parseXml(opfText);

	const titles = elementsByLocalName(opf, 'title').map((el) => cleanSpace(el.textContent));
	const creators = elementsByLocalName(opf, 'creator').map((el) => cleanSpace(el.textContent));
	let title = usableTitle(titles[0] || '', file.name);
	let author = joinAuthors(creators);

	const items = new Map();
	for (const item of elementsByLocalName(opf, 'item')) {
		const id = xmlAttr(item, 'id');
		if (!id) continue;
		items.set(id, {
			href: xmlAttr(item, 'href'),
			media: xmlAttr(item, 'media-type'),
			properties: xmlAttr(item, 'properties')
		});
	}

	let coverHref = '';
	for (const meta of elementsByLocalName(opf, 'meta')) {
		const name = (xmlAttr(meta, 'name') || xmlAttr(meta, 'property')).toLowerCase();
		if (name === 'cover' || name.endsWith(':cover') || name === 'cover-image') {
			const ref = xmlAttr(meta, 'content') || xmlAttr(meta, 'id') || cleanSpace(meta.textContent);
			if (items.has(ref)) coverHref = items.get(ref).href;
			else coverHref = ref;
			if (coverHref) break;
		}
	}
	if (!coverHref) {
		for (const item of items.values()) {
			const props = (item.properties || '').toLowerCase();
			const href = (item.href || '').toLowerCase();
			const media = (item.media || '').toLowerCase();
			if (props.includes('cover-image') || href.includes('cover')) {
				if (media.startsWith('image/') || /\.(jpe?g|png|gif|webp|svg)$/i.test(href)) {
					coverHref = item.href;
					break;
				}
			}
		}
	}
	if (!coverHref) {
		for (const item of items.values()) {
			if ((item.media || '').startsWith('image/') && item.href) {
				coverHref = item.href;
				break;
			}
		}
	}

	let coverUrl = null;
	if (coverHref) {
		const path = resolveZipPath(opfPath, coverHref);
		const bytes = await zip.get(path);
		if (bytes && bytes.length) {
			const media =
				[...items.values()].find((item) => resolveZipPath(opfPath, item.href) === path)?.media ||
				'image/jpeg';
			coverUrl = URL.createObjectURL(new Blob([bytes], { type: media || 'image/jpeg' }));
		}
	}

	const spineHrefs = [];
	for (const ref of elementsByLocalName(opf, 'itemref')) {
		const item = items.get(xmlAttr(ref, 'idref'));
		if (!item?.href) continue;
		if ((item.properties || '').toLowerCase().includes('nav')) continue;
		if (shouldSkipEpubHref(item.href)) continue;
		spineHrefs.push(item.href);
	}
	if (!spineHrefs.length) {
		for (const item of items.values()) {
			if (/\.(x?html?)$/i.test(item.href || '')) spineHrefs.push(item.href);
		}
	}

	let wordCount = 0;
	try {
		if (!title || !author) {
			for (const href of spineHrefs.slice(0, 8)) {
				const html = await zip.text(resolveZipPath(opfPath, href));
				if (!html) continue;
				const heading = firstHeading(html);
				const lines = htmlToText(html).split(/\n/);
				if (heading) lines.unshift(heading);
				const found = identityFromLines(lines, { forceFirstTitle: Boolean(heading) });
				if (!title && found.title) title = found.title;
				if (!author && found.author) author = found.author;
				if (title && author) break;
			}
		}
		for (const href of spineHrefs) {
			const html = await zip.text(resolveZipPath(opfPath, href));
			if (html) wordCount += countWords(htmlToText(html));
		}
	} catch {
		wordCount = wordCount || 0;
	}

	return withIdentity(
		{
			format: 'epub',
			pageCount: pagesFromWordCount(wordCount),
			coverUrl
		},
		file.name,
		title,
		author
	);
}

// -----------------------------------------------------------------------------
// PDF (pdfjs metadata + first-page render + first-page text)
// -----------------------------------------------------------------------------
async function loadPdfjs() {
	const pdfjs = await import('pdfjs-dist');
	const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
	pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
	return pdfjs;
}

function pdfLinesFromContent(content) {
	const lines = [];
	let lastY;
	let buf = [];
	for (const item of content.items || []) {
		const y = item.transform?.[5];
		const str = item.str || '';
		if (lastY != null && Math.abs(y - lastY) > 4 && buf.length) {
			lines.push(buf.join(' ').replace(/\s+/g, ' ').trim());
			buf = [];
		}
		if (str) buf.push(str);
		lastY = y;
	}
	if (buf.length) lines.push(buf.join(' ').replace(/\s+/g, ' ').trim());
	return lines.filter(Boolean);
}

async function canvasToUrl(canvas) {
	return new Promise((resolve) => {
		canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), 'image/jpeg', 0.82);
	});
}

async function previewPdf(file) {
	const pdfjs = await loadPdfjs();
	const data = new Uint8Array(await file.arrayBuffer());
	const task = pdfjs.getDocument({ data });
	const pdf = await task.promise;
	try {
		let title = '';
		let author = '';
		try {
			const meta = await pdf.getMetadata();
			title = usableTitle(meta?.info?.Title, file.name);
			author = usableAuthor(meta?.info?.Author);
		} catch {
			/* metadata is optional */
		}

		let coverUrl = null;
		try {
			if (pdf.numPages > 0) {
				const page = await pdf.getPage(1);
				const base = page.getViewport({ scale: 1 });
				const scale = Math.min(2, Math.max(0.75, 160 / Math.max(1, base.width)));
				const viewport = page.getViewport({ scale });
				const canvas = document.createElement('canvas');
				canvas.width = viewport.width;
				canvas.height = viewport.height;
				await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
				coverUrl = await canvasToUrl(canvas);
			}
		} catch {
			coverUrl = null;
		}

		if (!title || !author) {
			try {
				const limit = Math.min(pdf.numPages, 3);
				for (let n = 1; n <= limit; n += 1) {
					const page = await pdf.getPage(n);
					const content = await page.getTextContent();
					const found = identityFromLines(pdfLinesFromContent(content));
					if (!title && found.title) title = found.title;
					if (!author && found.author) author = found.author;
					if (title) break;
				}
			} catch {
				/* page text is optional once metadata exists */
			}
		}

		return withIdentity(
			{
				format: 'pdf',
				pageCount: pdf.numPages || null,
				coverUrl
			},
			file.name,
			title,
			author
		);
	} finally {
		await pdf.destroy();
	}
}

// -----------------------------------------------------------------------------
// TXT
// -----------------------------------------------------------------------------
async function previewTxt(file) {
	const text = await file.text();
	const found = identityFromLines(text.split(/\n/), { forceFirstTitle: true });
	return withIdentity(
		{
			format: 'txt',
			pageCount: pagesFromWordCount(countWords(text)),
			coverUrl: null
		},
		file.name,
		found.title,
		found.author
	);
}

export async function previewBookFile(file) {
	const fallback = fallbackPreview(file);
	if (!file || !fallback.format) return fallback;
	try {
		if (fallback.format === 'pdf') return await previewPdf(file);
		if (fallback.format === 'epub') return await previewEpub(file);
		if (fallback.format === 'txt') return await previewTxt(file);
	} catch {
		return fallback;
	}
	return fallback;
}
