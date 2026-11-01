import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ReactReader, ReactReaderStyle } from 'react-reader';

import { LoadingScreen } from '../ui';

const LOCATION_CHARS = 1500;

const EPUB_IFRAME_CSS = `
html, body {
  background: #000 !important;
  color: #f3f0e8 !important;
  font-family: "Source Serif 4", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif;
}
body, p, li, dt, dd, td, th, span, div, section, article {
  color: #f3f0e8 !important;
}
h1, h2, h3, h4, h5, h6,
section[data-type] h1,
section[data-type] h2,
section[data-type] h3,
section[data-type] h4,
section[data-type] h5,
section[data-type] h6,
div[data-type] h1,
div[data-type] h2 {
  color: #f3f0e8 !important;
}
img, svg, figure {
  max-width: 100%;
  height: auto;
}
figure {
  max-height: 100%;
  overflow: hidden;
  background: transparent !important;
}
caption,
figcaption,
figure h6,
div.figure h6,
span.label,
caption .label,
figure .label {
  color: #cfc8bc !important;
  background: transparent !important;
  background-color: transparent !important;
}
a {
  color: inherit !important;
  text-decoration: none !important;
}
a.ulink, a.xref, a.email, a.link,
a[data-type="noteref"],
p[data-type="footnote"] a,
p[data-type="footnote"] a[href$="-marker"],
div.toc a {
  color: #a8a29a !important;
  text-decoration: none !important;
}
a[data-type="indexterm"] {
  color: inherit !important;
  text-decoration: none !important;
}
table, thead, tbody, tfoot, tr, td, th, caption {
  color: #f3f0e8 !important;
  background: transparent !important;
  background-color: transparent !important;
}
table {
  max-width: 100%;
  overflow-x: auto;
  display: block;
  border-collapse: collapse;
}
thead th, thead td {
  background: #1c1c1c !important;
  background-color: #1c1c1c !important;
  color: #f3f0e8 !important;
  border-color: #3a3a3a !important;
}
tr:nth-of-type(even),
tr:nth-of-type(even) > td,
tr:nth-of-type(even) > th {
  background: #161616 !important;
  background-color: #161616 !important;
  color: #f3f0e8 !important;
}
tr:nth-of-type(odd),
tr:nth-of-type(odd) > td,
tr:nth-of-type(odd) > th {
  background: transparent !important;
  background-color: transparent !important;
  color: #f3f0e8 !important;
}
td, th {
  color: #f3f0e8 !important;
  border-color: #3a3a3a !important;
}
td p, th p {
  color: #f3f0e8 !important;
}
aside,
aside[data-type="sidebar"],
div.sidebar,
div.tip, div.note, div.warning,
div[data-type="tip"],
div[data-type="note"],
div[data-type="warning"],
div[data-type="caution"],
div[data-type="important"] {
  background: #161616 !important;
  background-color: #161616 !important;
  border: 1px solid #3a3a3a !important;
  color: #f3f0e8 !important;
}
aside *:not(.sidebar),
div.sidebar *,
div.tip *,
div.note *,
div.warning *,
div[data-type="tip"] *,
div[data-type="note"] *,
div[data-type="warning"] *,
div[data-type="caution"] *,
div[data-type="important"] * {
  color: #f3f0e8 !important;
  background-color: transparent !important;
}
`;

const readerStyles = {
	...ReactReaderStyle,
	container: {
		...ReactReaderStyle.container,
		background: '#000'
	},
	readerArea: {
		...ReactReaderStyle.readerArea,
		backgroundColor: '#000'
	},
	titleArea: {
		display: 'none'
	},
	reader: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0
	},
	arrow: {
		display: 'none'
	},
	prev: {
		display: 'none'
	},
	next: {
		display: 'none'
	},
	tocButton: {
		display: 'none'
	}
};

function clampPage(value, pageCount) {
	const max = Math.max(1, pageCount || 1);
	return Math.min(max, Math.max(1, value));
}

function pageFromCfi(book, cfi, pageCount) {
	if (!book?.locations || !cfi) return null;
	const pct = book.locations.percentageFromCfi(cfi);
	if (pct == null || Number.isNaN(pct)) return null;
	return clampPage(Math.round(pct * Math.max(1, pageCount || 1)) || 1, pageCount);
}

function injectContentStyles(contents) {
	const doc = contents.document;
	if (!doc) return;
	const mount = (parent) => {
		if (!parent || parent.querySelector('style[data-dumaread-theme]')) return;
		const style = doc.createElement('style');
		style.setAttribute('data-dumaread-theme', '1');
		style.textContent = EPUB_IFRAME_CSS;
		parent.appendChild(style);
	};
	mount(doc.head);
	mount(doc.body);
}

function applyRenditionTheme(rendition) {
	rendition.themes.default({
		body: {
			background: '#000',
			color: '#f3f0e8',
			'font-family': '"Source Serif 4", Georgia, serif'
		},
		'img, svg, figure': {
			'max-width': '100%',
			height: 'auto'
		},
		figure: {
			'max-height': '100%',
			overflow: 'hidden'
		},
		table: {
			'max-width': '100%',
			display: 'block'
		}
	});
}

export const EpubReader = forwardRef(function EpubReader(
	{ data, twoPage, pageCount, initialPage, onPageChange, onBoundsChange, onReady },
	ref
) {
	const renditionRef = useRef(null);
	const bookRef = useRef(null);
	const locationsReadyRef = useRef(false);
	const resumeAppliedRef = useRef(false);
	const userMovedRef = useRef(false);
	const lastCfiRef = useRef('');
	const pageCountRef = useRef(pageCount);
	const initialPageRef = useRef(initialPage);
	const onPageChangeRef = useRef(onPageChange);
	const onBoundsChangeRef = useRef(onBoundsChange);
	const onReadyRef = useRef(onReady);
	const [location, setLocation] = useState(null);

	pageCountRef.current = pageCount;
	initialPageRef.current = initialPage;
	onPageChangeRef.current = onPageChange;
	onBoundsChangeRef.current = onBoundsChange;
	onReadyRef.current = onReady;

	useImperativeHandle(ref, () => ({
		next: () => {
			userMovedRef.current = true;
			renditionRef.current?.next();
		},
		prev: () => {
			userMovedRef.current = true;
			renditionRef.current?.prev();
		}
	}));

	const reportPage = useCallback((cfi) => {
		if (!cfi || !locationsReadyRef.current) return;
		const page = pageFromCfi(bookRef.current, cfi, pageCountRef.current);
		if (page != null) onPageChangeRef.current?.(page);
	}, []);

	const applyResume = useCallback(() => {
		if (resumeAppliedRef.current || !locationsReadyRef.current) return;
		if (userMovedRef.current) {
			resumeAppliedRef.current = true;
			return;
		}
		const count = Math.max(1, pageCountRef.current || 1);
		const start = clampPage(initialPageRef.current || 1, count);
		if (start <= 1) {
			resumeAppliedRef.current = true;
			return;
		}
		const cfi = bookRef.current?.locations.cfiFromPercentage((start - 1) / count);
		resumeAppliedRef.current = true;
		if (cfi) setLocation(cfi);
	}, []);

	const getRendition = useCallback(
		(rendition) => {
			renditionRef.current = rendition;
			bookRef.current = rendition.book;
			locationsReadyRef.current = false;
			resumeAppliedRef.current = false;
			rendition.spread(twoPage ? 'always' : 'none', 0);
			applyRenditionTheme(rendition);
			rendition.hooks.content.register(injectContentStyles);
			rendition.on('keyup', (event) => {
				if (event.key === 'ArrowRight' || event.key === 'PageDown') {
					userMovedRef.current = true;
					rendition.next();
				} else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
					userMovedRef.current = true;
					rendition.prev();
				}
			});
			rendition.on('relocated', (loc) => {
				onBoundsChangeRef.current?.({
					atStart: Boolean(loc.atStart),
					atEnd: Boolean(loc.atEnd)
				});
				const cfi = loc.start?.cfi;
				if (!cfi) return;
				lastCfiRef.current = cfi;
				reportPage(cfi);
			});
			const book = rendition.book;
			book.ready
				.then(() => book.locations.generate(LOCATION_CHARS))
				.then(() => {
					locationsReadyRef.current = true;
					applyResume();
					if (lastCfiRef.current) reportPage(lastCfiRef.current);
					onReadyRef.current?.();
				})
				.catch(() => {
					onReadyRef.current?.();
				});
		},
		[applyResume, reportPage, twoPage]
	);

	useEffect(() => {
		renditionRef.current?.spread(twoPage ? 'always' : 'none', 0);
	}, [twoPage]);

	const onLocationChanged = useCallback((value) => {
		if (!value || value === '[object Object]') return;
		setLocation(value);
	}, []);

	if (!data) return null;

	return (
		<div className="reader-epub">
			<ReactReader
				url={data}
				title=""
				showToc={false}
				location={location}
				locationChanged={onLocationChanged}
				getRendition={getRendition}
				handleKeyPress={() => {}}
				readerStyles={readerStyles}
				epubOptions={{
					flow: 'paginated',
					spread: twoPage ? 'always' : 'none',
					minSpreadWidth: 0,
					allowScriptedContent: false
				}}
				loadingView={<LoadingScreen label="Opening EPUB…" />}
				errorView={
					<p className="p-8 text-center text-sm text-red-400">Could not open this EPUB.</p>
				}
			/>
		</div>
	);
});
