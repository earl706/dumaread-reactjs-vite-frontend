import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
	ArrowLeft,
	Bookmark,
	ChevronLeft,
	ChevronRight,
	Download,
	Maximize2,
	Minimize2,
	Scan,
	WifiOff,
	ZoomIn
} from 'lucide-react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

import { removeBookForOffline, saveBookForOffline } from '../lib/offline/actions';
import { isOnline } from '../lib/offline/connectivity';
import { getMergedBookProgress } from '../lib/offline/localProgress';
import {
	bookFromSavedMeta,
	getSavedBookContent,
	getSavedBookMeta,
	isBookSaved,
	touchSavedBook
} from '../lib/offline/savedBooks';
import { booksApi } from '../lib/resources';
import {
	WORDS_PER_PAGE,
	backendPageFromVisual,
	pageIndexForWordOffset,
	paginateToFit,
	wordOffsetAtPage
} from '../lib/reading';
import { formatDurationSeconds } from '../lib/format';
import { formatTimerDisplay } from '../lib/timerFormat';
import { useAuthStore } from '../stores/authStore';
import { useOfflineStore } from '../stores/offlineStore';
import { toast } from '../stores/toastStore';
import { selectIntervalActive } from '../stores/createTimerStore';
import { readingTimer } from '../stores/readingTimer';
import { useReadingSession } from '../hooks/useReadingSession';
import { EpubReader } from '../components/books/EpubReader';
import { Button, EmptyState, LoadingScreen, ProgressRing } from '../components/ui';

GlobalWorkerOptions.workerSrc = pdfWorker;

const PDF_FIT_STORAGE_KEY = 'dumaread.pdfFitMode';
const CHROME_IDLE_MS = 3000;

function getFullscreenElement() {
	return document.fullscreenElement || document.webkitFullscreenElement || null;
}

async function enterFullscreen(el) {
	if (!el) return;
	if (el.requestFullscreen) {
		await el.requestFullscreen();
		return;
	}
	if (el.webkitRequestFullscreen) {
		await el.webkitRequestFullscreen();
	}
}

async function exitFullscreen() {
	if (document.exitFullscreen) {
		await document.exitFullscreen();
		return;
	}
	if (document.webkitExitFullscreen) {
		await document.webkitExitFullscreen();
	}
}

function readPdfFitMode() {
	try {
		const stored = localStorage.getItem(PDF_FIT_STORAGE_KEY);
		return stored === 'stretch' ? 'stretch' : 'fit';
	} catch {
		return 'fit';
	}
}

function useTwoPage() {
	const [twoPage, setTwoPage] = useState(() =>
		typeof window === 'undefined' ? true : window.matchMedia('(min-width: 900px)').matches
	);
	useEffect(() => {
		const mq = window.matchMedia('(min-width: 900px)');
		const onChange = () => setTwoPage(mq.matches);
		onChange();
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	}, []);
	return twoPage;
}

function PageProse({ blocks }) {
	if (!blocks?.length) return null;
	return (
		<div className="reader-prose">
			{blocks.map((block, i) => {
				if (block.type === 'h') return <h2 key={i}>{block.text}</h2>;
				if (block.type === 'ul') {
					return (
						<ul key={i}>
							{block.items.map((item, j) => (
								<li key={j}>{item}</li>
							))}
						</ul>
					);
				}
				return <p key={i}>{block.text}</p>;
			})}
		</div>
	);
}

function PdfCanvas({ pdf, pageNumber, fitMode }) {
	const canvasRef = useRef(null);
	const [error, setError] = useState('');
	const [frame, setFrame] = useState(0);
	const stretch = fitMode === 'stretch';

	useEffect(() => {
		const parent = canvasRef.current?.parentElement;
		if (!parent) return undefined;
		const ro = new ResizeObserver(() => setFrame((n) => n + 1));
		ro.observe(parent);
		return () => ro.disconnect();
	}, [pdf]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!pdf || !canvas || !pageNumber) return undefined;
		let cancelled = false;
		let renderTask;
		pdf
			.getPage(pageNumber)
			.then((page) => {
				if (cancelled) return undefined;
				const base = page.getViewport({ scale: 1 });
				const parent = canvas.parentElement;
				const maxWidth = Math.max(120, parent?.clientWidth || 480);
				const maxHeight = Math.max(160, parent?.clientHeight || 640);
				const scale = stretch
					? Math.max(maxWidth / base.width, maxHeight / base.height)
					: Math.min(maxWidth / base.width, maxHeight / base.height);
				const viewport = page.getViewport({ scale });
				const context = canvas.getContext('2d');
				canvas.width = viewport.width;
				canvas.height = viewport.height;
				renderTask = page.render({ canvasContext: context, viewport });
				return renderTask.promise;
			})
			.catch(() => {
				if (!cancelled) setError('Could not render this page.');
			});
		return () => {
			cancelled = true;
			renderTask?.cancel();
		};
	}, [pdf, pageNumber, frame, stretch]);

	if (error) {
		return <p className="p-8 text-center text-sm text-red-400">{error}</p>;
	}
	return (
		<canvas
			ref={canvasRef}
			className={
				stretch ? 'reader-pdf-cover bg-white' : 'mx-auto max-h-full max-w-full bg-white shadow-sm'
			}
		/>
	);
}

function PdfSpread({ data, leftPage, rightPage, twoPage, fitMode }) {
	const [pdf, setPdf] = useState(null);
	const [error, setError] = useState('');

	useEffect(() => {
		if (!data) return undefined;
		let cancelled = false;
		let loaded;
		const task = getDocument({ data });
		task.promise
			.then((doc) => {
				if (cancelled) {
					doc.destroy();
					return;
				}
				loaded = doc;
				setPdf(doc);
			})
			.catch(() => {
				if (!cancelled) setError('Could not open this PDF.');
			});
		return () => {
			cancelled = true;
			task.destroy();
			loaded?.destroy();
			setPdf(null);
		};
	}, [data]);

	if (error) {
		return <p className="p-8 text-center text-sm text-red-400">{error}</p>;
	}
	return (
		<>
			<div className="reader-page flex items-center justify-center">
				{pdf ? (
					<PdfCanvas pdf={pdf} pageNumber={leftPage} fitMode={fitMode} />
				) : (
					<LoadingScreen label="Rendering PDF…" />
				)}
			</div>
			{twoPage ? (
				<div className="reader-page flex items-center justify-center">
					{pdf && rightPage ? (
						<PdfCanvas pdf={pdf} pageNumber={rightPage} fitMode={fitMode} />
					) : null}
				</div>
			) : null}
		</>
	);
}

function TextSpread({ pages, leftPage, rightPage, twoPage }) {
	return (
		<>
			<div className="reader-page">
				<PageProse blocks={pages[leftPage - 1] || []} />
			</div>
			{twoPage ? (
				<div className="reader-page">
					{rightPage ? <PageProse blocks={pages[rightPage - 1] || []} /> : null}
				</div>
			) : null}
		</>
	);
}

export default function ReaderPage() {
	const { id } = useParams();
	const navigate = useNavigate();
	const twoPage = useTwoPage();
	const user = useAuthStore((s) => s.user);
	const online = useOfflineStore((s) => s.online);
	const savedIds = useOfflineStore((s) => s.savedIds);
	const {
		data: remoteBook,
		isLoading,
		isError,
		isFetching
	} = booksApi.useDetail(id, {
		retry: online ? 1 : 0,
		// Offline cold-open: skip the API so IndexedDB hydrate is not blocked by timeouts.
		enabled: Boolean(id) && online
	});
	const bookmarkBook = booksApi.useBookmark({
		onSuccess: (data) => {
			toast.success(
				data?.bookmark_page ? `Bookmarked page ${data.bookmark_page}.` : 'Bookmark removed.'
			);
		},
		onError: () => toast.error('Could not update bookmark.')
	});

	const timerSessionActive = readingTimer.useStore(selectIntervalActive);
	const timerRemaining = readingTimer.useStore((s) => s.remainingSeconds);
	const timerTotal = readingTimer.useStore((s) => s.totalSeconds);
	const timerRemainingPct = timerTotal > 0 ? (timerRemaining / timerTotal) * 100 : 0;
	const timerDisplay = formatTimerDisplay(timerRemaining);

	useEffect(() => {
		const root = document.documentElement;
		root.classList.add('reader-lock');
		return () => root.classList.remove('reader-lock');
	}, []);
	const [offlineBook, setOfflineBook] = useState(null);
	const [offlineResolving, setOfflineResolving] = useState(false);
	const [page, setPage] = useState(null);
	const [fileBytes, setFileBytes] = useState(null);
	const [text, setText] = useState('');
	const [loadError, setLoadError] = useState('');
	const [contentReady, setContentReady] = useState(false);
	const [textPages, setTextPages] = useState([[]]);
	const [pagesReady, setPagesReady] = useState(false);
	const [pageBox, setPageBox] = useState({ width: 0, height: 0 });
	const [epubAtStart, setEpubAtStart] = useState(true);
	const [epubAtEnd, setEpubAtEnd] = useState(false);
	const shellRef = useRef(null);
	const spreadRef = useRef(null);
	const epubRef = useRef(null);
	const wordOffsetRef = useRef(0);
	const sessionStartedAt = useRef(Date.now());
	const chromeIdleTimerRef = useRef(null);
	const [elapsed, setElapsed] = useState(0);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [chromeVisible, setChromeVisible] = useState(false);
	const [pdfFitMode, setPdfFitMode] = useState(readPdfFitMode);

	const book = remoteBook || offlineBook;
	const isSavedOffline = savedIds.includes(Number(id));
	const readingOffline = Boolean(book?._offline) || (!online && Boolean(book));

	useEffect(() => {
		setOfflineBook(null);
		setOfflineResolving(false);
	}, [id]);

	useEffect(() => {
		if (remoteBook || !user?.id || !id) return undefined;
		if (isLoading || isFetching) return undefined;
		if (online && !isError) return undefined;

		let cancelled = false;
		setOfflineResolving(true);
		(async () => {
			try {
				const meta = await getSavedBookMeta(user.id, id);
				if (cancelled) return;
				if (!meta) {
					setOfflineBook(null);
					return;
				}
				const progress = await getMergedBookProgress(user.id, id);
				if (cancelled) return;
				setOfflineBook(bookFromSavedMeta(meta, progress));
				await touchSavedBook(user.id, id);
			} catch {
				if (!cancelled) setOfflineBook(null);
			} finally {
				if (!cancelled) setOfflineResolving(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [remoteBook, user?.id, id, isLoading, isFetching, online, isError]);

	useEffect(() => {
		const sync = () => {
			const active = getFullscreenElement();
			setIsFullscreen(Boolean(active && active === shellRef.current));
		};
		document.addEventListener('fullscreenchange', sync);
		document.addEventListener('webkitfullscreenchange', sync);
		return () => {
			document.removeEventListener('fullscreenchange', sync);
			document.removeEventListener('webkitfullscreenchange', sync);
		};
	}, []);

	const toggleFullscreen = useCallback(async () => {
		try {
			if (getFullscreenElement()) {
				await exitFullscreen();
			} else {
				await enterFullscreen(shellRef.current);
			}
		} catch {
			toast.error('Fullscreen is not available here.');
		}
	}, []);

	const isPdf = book?.format === 'pdf';
	const isEpub = book?.format === 'epub';
	const isTxt = book?.format === 'txt';
	const immersiveChrome = isPdf || isEpub;

	const showChromeFromCursor = useCallback(() => {
		if (!immersiveChrome) return;
		setChromeVisible(true);
		if (chromeIdleTimerRef.current) window.clearTimeout(chromeIdleTimerRef.current);
		chromeIdleTimerRef.current = window.setTimeout(() => {
			setChromeVisible(false);
		}, CHROME_IDLE_MS);
	}, [immersiveChrome]);

	useEffect(() => {
		if (!immersiveChrome) {
			setChromeVisible(true);
			if (chromeIdleTimerRef.current) {
				window.clearTimeout(chromeIdleTimerRef.current);
				chromeIdleTimerRef.current = null;
			}
			return undefined;
		}
		setChromeVisible(false);
		return () => {
			if (chromeIdleTimerRef.current) {
				window.clearTimeout(chromeIdleTimerRef.current);
				chromeIdleTimerRef.current = null;
			}
		};
	}, [immersiveChrome, book?.id]);

	useEffect(() => {
		if (!immersiveChrome) return undefined;
		const shell = shellRef.current;
		if (!shell) return undefined;
		// Desktop: pointermove. Mobile/PWA: tap/click (pointermove often never fires).
		const reveal = () => showChromeFromCursor();
		shell.addEventListener('pointermove', reveal);
		shell.addEventListener('pointerdown', reveal);
		shell.addEventListener('touchstart', reveal, { passive: true });
		return () => {
			shell.removeEventListener('pointermove', reveal);
			shell.removeEventListener('pointerdown', reveal);
			shell.removeEventListener('touchstart', reveal);
		};
	}, [immersiveChrome, showChromeFromCursor, book?.id]);

	const togglePdfFitMode = useCallback(() => {
		setPdfFitMode((prev) => {
			const next = prev === 'stretch' ? 'fit' : 'stretch';
			try {
				localStorage.setItem(PDF_FIT_STORAGE_KEY, next);
			} catch {
				/* ignore */
			}
			return next;
		});
	}, []);

	useEffect(() => {
		if (!book) return;
		const start =
			book.bookmark_page > 0 ? book.bookmark_page : book.current_page > 0 ? book.current_page : 1;
		if (isPdf || isEpub) {
			setPage(start);
			setPagesReady(isPdf);
			setEpubAtStart(start <= 1);
			setEpubAtEnd(false);
		} else {
			wordOffsetRef.current = Math.max(0, (start - 1) * WORDS_PER_PAGE);
			setPage(null);
			setPagesReady(false);
			setTextPages([[]]);
		}
	}, [book?.id, isPdf, isEpub]);

	useEffect(() => {
		if (!book) return undefined;
		let cancelled = false;
		setContentReady(false);
		setLoadError('');
		setFileBytes(null);
		setText('');
		(async () => {
			try {
				const preferOffline = !isOnline() || book._offline;
				if (preferOffline && user?.id) {
					const saved = await getSavedBookContent(user.id, book.id);
					if (cancelled) return;
					if (saved) {
						if (isPdf || isEpub) {
							setFileBytes(saved);
						} else {
							setText(saved.text || '');
						}
						setContentReady(true);
						return;
					}
					if (!isOnline()) {
						setLoadError('This book isn’t saved for offline.');
						return;
					}
				}

				if (isPdf || isEpub) {
					const blob = await booksApi.fetchFile(book.id);
					const buf = await blob.arrayBuffer();
					if (!cancelled) setFileBytes(buf);
				} else {
					const payload = await booksApi.fetchText(book.id);
					if (!cancelled) setText(payload.text || '');
				}
				if (!cancelled) setContentReady(true);

				if (user?.id && isOnline()) {
					const saved = await isBookSaved(user.id, book.id);
					if (saved && !cancelled) {
						saveBookForOffline(book).catch(() => {});
					}
				}
			} catch {
				if (cancelled) return;
				if (user?.id) {
					try {
						const saved = await getSavedBookContent(user.id, book.id);
						if (saved) {
							if (isPdf || isEpub) setFileBytes(saved);
							else setText(saved.text || '');
							setContentReady(true);
							return;
						}
					} catch {
						/* fall through */
					}
				}
				setLoadError('Could not load this book.');
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [book?.id, book?._offline, isPdf, isEpub, user?.id]);

	const totalPages = isPdf || isEpub ? book?.page_count || 1 : textPages.length || 1;
	const currentPage = page == null ? 1 : Math.min(Math.max(page, 1), totalPages);
	const turn = twoPage ? 2 : 1;
	const leftPage = twoPage && currentPage % 2 === 0 ? currentPage - 1 : currentPage;
	const rightPage = twoPage && leftPage + 1 <= totalPages ? leftPage + 1 : null;
	const footerPage = isEpub ? currentPage : rightPage || leftPage;
	const trackedPage =
		isPdf || isEpub
			? footerPage
			: backendPageFromVisual(textPages, footerPage, book?.page_count || 1);
	const libraryTotal = Math.max(1, book?.page_count || 1);
	const libraryPage = Math.min(Math.max(trackedPage || 1, 1), libraryTotal);
	const progressPercent = Math.round((100 * libraryPage) / libraryTotal);
	const pagesLeft = Math.max(0, libraryTotal - libraryPage);

	useReadingSession({
		bookId: book?.id,
		currentPage: trackedPage,
		enabled: Boolean(book) && contentReady && pagesReady && !loadError && page != null
	});

	useEffect(() => {
		const timer = window.setInterval(() => {
			setElapsed(Math.floor((Date.now() - sessionStartedAt.current) / 1000));
		}, 1000);
		return () => window.clearInterval(timer);
	}, []);

	useEffect(() => {
		if (isPdf || isEpub || !contentReady || loadError) return undefined;
		const root = spreadRef.current;
		if (!root) return undefined;
		const pageEl = root.querySelector('.reader-page');
		if (!pageEl) return undefined;
		const update = () => {
			const w = Math.round(pageEl.clientWidth);
			const h = Math.round(pageEl.clientHeight);
			setPageBox((prev) =>
				prev.width === w && prev.height === h ? prev : { width: w, height: h }
			);
		};
		update();
		const ro = new ResizeObserver(update);
		ro.observe(pageEl);
		return () => ro.disconnect();
	}, [contentReady, loadError, twoPage, isPdf, isEpub]);

	useEffect(() => {
		if (!isTxt || !text || pageBox.width < 40 || pageBox.height < 40) return undefined;
		let cancelled = false;
		const run = () => {
			if (cancelled) return;
			const pages = paginateToFit(text, pageBox);
			if (cancelled) return;
			setTextPages(pages);
			setPage(pageIndexForWordOffset(pages, wordOffsetRef.current) + 1);
			setPagesReady(true);
		};
		const fonts = document.fonts?.ready;
		if (fonts) fonts.then(run);
		else run();
		return () => {
			cancelled = true;
		};
	}, [isTxt, text, pageBox.width, pageBox.height]);

	const go = useCallback(
		(next) => {
			const clamped = Math.min(Math.max(next, 1), totalPages);
			setPage(clamped);
			if (isTxt) {
				const left = twoPage && clamped % 2 === 0 ? clamped - 1 : clamped;
				wordOffsetRef.current = wordOffsetAtPage(textPages, left);
			}
		},
		[totalPages, isTxt, twoPage, textPages]
	);

	const playPageTurn = useCallback((dir) => {
		const el = spreadRef.current;
		if (!el) return;
		el.classList.remove('reader-turn-next', 'reader-turn-prev');
		void el.offsetWidth;
		el.classList.add(dir > 0 ? 'reader-turn-next' : 'reader-turn-prev');
	}, []);

	const goPrev = useCallback(() => {
		playPageTurn(-1);
		if (isEpub) {
			epubRef.current?.prev();
			return;
		}
		go(leftPage - turn);
	}, [go, isEpub, leftPage, playPageTurn, turn]);
	const goNext = useCallback(() => {
		playPageTurn(1);
		if (isEpub) {
			epubRef.current?.next();
			return;
		}
		go(leftPage + turn);
	}, [go, isEpub, leftPage, playPageTurn, turn]);
	const canPrev = isEpub ? !epubAtStart : leftPage > 1;
	const canNext = isEpub ? !epubAtEnd : footerPage < totalPages;

	useEffect(() => {
		const onKey = (e) => {
			const typing =
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement ||
				(e.target instanceof HTMLElement && e.target.isContentEditable);
			if (e.key === 'Escape') {
				e.preventDefault();
				navigate('/library');
				return;
			}
			if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
			if (e.key === 'f' || e.key === 'F') {
				e.preventDefault();
				toggleFullscreen();
				return;
			}
			if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
				e.preventDefault();
				if (canNext) goNext();
			} else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
				e.preventDefault();
				if (canPrev) goPrev();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [canNext, canPrev, goNext, goPrev, navigate, toggleFullscreen]);

	if ((isLoading || offlineResolving) && !book) {
		return (
			<div className="reader-shell flex items-center justify-center">
				<LoadingScreen label="Opening book…" />
			</div>
		);
	}
	if (!book) {
		const offlineMiss = !online || isError;
		return (
			<div className="reader-shell flex items-center justify-center p-8">
				<EmptyState
					title={offlineMiss ? 'Unavailable offline' : 'Book not found'}
					description={
						offlineMiss
							? 'Save this book for offline reading while you’re online, then try again.'
							: 'This book is missing or you do not have access.'
					}
					action={
						<Link to="/library">
							<Button variant="secondary">Back to library</Button>
						</Link>
					}
				/>
			</div>
		);
	}

	const toggleOfflineSave = async () => {
		if (isSavedOffline) await removeBookForOffline(book.id, book.title);
		else await saveBookForOffline(book);
	};

	const spreadClass = isPdf
		? `reader-spread reader-spread-pdf${twoPage ? '' : ' reader-spread-single'}${
				pdfFitMode === 'stretch' ? ' reader-spread-pdf-stretch' : ''
			}`
		: isEpub
			? 'reader-spread reader-spread-epub'
			: twoPage
				? 'reader-spread'
				: 'reader-spread reader-spread-single';
	const footerSplit = twoPage && rightPage && !isEpub;
	const bookmarkPage = book.bookmark_page > 0 ? book.bookmark_page : null;
	const hasBookmark = bookmarkPage != null;
	const onBookmarkedPage =
		hasBookmark &&
		(libraryPage === bookmarkPage ||
			(twoPage && !isEpub && (leftPage === bookmarkPage || rightPage === bookmarkPage)));
	const offlineSaveButton = (
		<button
			type="button"
			className="reader-nav inline-flex h-9 w-9 items-center justify-center rounded-md"
			onClick={toggleOfflineSave}
			aria-label={isSavedOffline ? 'Remove offline copy' : 'Save for offline'}
			title={isSavedOffline ? 'Remove offline copy' : 'Save for offline'}
		>
			{isSavedOffline ? (
				<WifiOff size={16} strokeWidth={1.5} />
			) : (
				<Download size={16} strokeWidth={1.5} />
			)}
		</button>
	);

	const toggleBookmark = () => {
		if (readingOffline) {
			toast.info('Bookmarks need a network connection.');
			return;
		}
		if (bookmarkBook.isPending || page == null) return;
		if (hasBookmark) {
			bookmarkBook.mutate({ id: book.id, page: null });
			return;
		}
		bookmarkBook.mutate({ id: book.id, page: trackedPage });
	};

	const elapsedLabel = (
		<p className="hidden text-[11px] text-[#6e6e6e] sm:block">
			{formatDurationSeconds(elapsed)}
			{book.total_reading_seconds
				? ` · ${formatDurationSeconds(book.total_reading_seconds)} total`
				: ''}
		</p>
	);

	const timerRing = timerSessionActive ? (
		<div
			className="inline-flex items-center justify-center"
			role="img"
			aria-label={`Reading timer ${timerDisplay} remaining`}
			title={`Reading timer ${timerDisplay} remaining`}
		>
			<ProgressRing value={timerRemainingPct} size={28} stroke={3} tone="primary" label="" />
		</div>
	) : null;

	const bookmarkButton = (
		<button
			type="button"
			className={`inline-flex items-center justify-center disabled:opacity-50 ${
				onBookmarkedPage ? 'text-primary' : 'reader-nav'
			}`}
			style={onBookmarkedPage ? { color: 'var(--primary)' } : undefined}
			onClick={toggleBookmark}
			disabled={bookmarkBook.isPending || page == null || readingOffline}
			aria-label={
				hasBookmark
					? onBookmarkedPage
						? 'Remove bookmark from this page'
						: `Bookmark on page ${bookmarkPage}; click to remove`
					: 'Bookmark this page'
			}
			aria-pressed={onBookmarkedPage}
			title={
				hasBookmark
					? onBookmarkedPage
						? `Bookmarked (page ${bookmarkPage})`
						: `Bookmark on page ${bookmarkPage}`
					: 'Bookmark this page'
			}
		>
			<Bookmark
				size={18}
				strokeWidth={onBookmarkedPage ? 2 : 1.5}
				absoluteStrokeWidth
				fill={onBookmarkedPage ? 'var(--primary)' : 'none'}
				color={onBookmarkedPage ? 'var(--primary)' : 'currentColor'}
			/>
		</button>
	);

	const fullscreenButton = (
		<button
			type="button"
			className="reader-nav inline-flex h-9 w-9 items-center justify-center rounded-md"
			onClick={toggleFullscreen}
			aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
			aria-pressed={isFullscreen}
			title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
		>
			{isFullscreen ? (
				<Minimize2 size={16} strokeWidth={1.5} />
			) : (
				<Maximize2 size={16} strokeWidth={1.5} />
			)}
		</button>
	);

	const fitToggleButton = (
		<button
			type="button"
			className="reader-nav inline-flex h-9 w-9 items-center justify-center rounded-md"
			onClick={togglePdfFitMode}
			aria-label={
				pdfFitMode === 'stretch'
					? 'Fit pages (show entire page)'
					: 'Fill screen (zoom, keep proportions)'
			}
			aria-pressed={pdfFitMode === 'stretch'}
			title={pdfFitMode === 'stretch' ? 'Fit (entire page)' : 'Fill (zoom to cover)'}
		>
			{pdfFitMode === 'stretch' ? (
				<Scan size={16} strokeWidth={1.5} />
			) : (
				<ZoomIn size={16} strokeWidth={1.5} />
			)}
		</button>
	);

	const contentBody = loadError ? (
		<EmptyState title="Could not open this file" description={loadError} />
	) : !contentReady ? (
		<LoadingScreen label="Loading pages…" />
	) : (
		<div ref={spreadRef} className={spreadClass}>
			{isPdf ? (
				<PdfSpread
					data={fileBytes}
					leftPage={leftPage}
					rightPage={rightPage}
					twoPage={twoPage}
					fitMode={pdfFitMode}
				/>
			) : isEpub ? (
				<EpubReader
					ref={epubRef}
					data={fileBytes}
					twoPage={twoPage}
					pageCount={book.page_count || 1}
					initialPage={
						book.bookmark_page > 0
							? book.bookmark_page
							: book.current_page > 0
								? book.current_page
								: 1
					}
					onPageChange={setPage}
					onBoundsChange={({ atStart, atEnd }) => {
						setEpubAtStart(atStart);
						setEpubAtEnd(atEnd);
					}}
					onReady={() => setPagesReady(true)}
					onPointerActivity={showChromeFromCursor}
				/>
			) : (
				<TextSpread pages={textPages} leftPage={leftPage} rightPage={rightPage} twoPage={twoPage} />
			)}
		</div>
	);

	if (immersiveChrome) {
		const chromeHidden = !chromeVisible;
		return (
			<div ref={shellRef} className={`reader-shell relative ${chromeHidden ? 'reader-idle' : ''}`}>
				<div className={`absolute inset-0 overflow-hidden ${isEpub ? 'reader-epub-inset' : ''}`}>
					{contentBody}
				</div>

				<button
					type="button"
					className="reader-edge-hit reader-edge-hit-left"
					onClick={goPrev}
					disabled={!canPrev}
					aria-label="Previous pages"
				/>
				<button
					type="button"
					className="reader-edge-hit reader-edge-hit-right"
					onClick={goNext}
					disabled={!canNext}
					aria-label="Next pages"
				/>

				<div
					className={`reader-chrome pointer-events-none absolute inset-0 z-20 ${
						chromeHidden ? 'reader-chrome-hidden' : ''
					}`}
					aria-hidden={chromeHidden}
				>
					<div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-linear-to-b from-black/85 via-black/50 to-transparent" />
					<div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-linear-to-t from-black/85 via-black/50 to-transparent" />

					<div className="pointer-events-auto absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-4 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3">
						<Link
							to="/library"
							aria-label="Library"
							className="reader-nav relative z-30 inline-flex shrink-0 items-center gap-1 text-xs"
						>
							<ArrowLeft size={14} />
							<span className="hidden sm:inline">Library</span>
						</Link>
						<p className="font-reader min-w-0 flex-1 truncate text-center text-[12px] tracking-wide text-[#9a9a9a]">
							{book.title}
						</p>
						<div className="relative z-30 flex shrink-0 items-center gap-3">
							{elapsedLabel}
							{timerRing}
							{offlineSaveButton}
							{bookmarkButton}
						</div>
					</div>

					<button
						type="button"
						className="reader-nav pointer-events-auto absolute top-16 bottom-16 left-0 z-10 flex w-14 items-center justify-center"
						onClick={goPrev}
						disabled={!canPrev}
						tabIndex={chromeHidden ? -1 : 0}
						aria-label="Previous pages"
					>
						<ChevronLeft size={28} strokeWidth={1.5} />
					</button>
					<button
						type="button"
						className="reader-nav pointer-events-auto absolute top-16 right-0 bottom-16 z-10 flex w-14 items-center justify-center"
						onClick={goNext}
						disabled={!canNext}
						tabIndex={chromeHidden ? -1 : 0}
						aria-label="Next pages"
					>
						<ChevronRight size={28} strokeWidth={1.5} />
					</button>

					<div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex items-end justify-between gap-4 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
						<div
							className={`min-w-0 flex-1 text-[12px] text-[#8a8a8a] ${
								footerSplit ? 'grid grid-cols-2' : 'flex justify-between'
							}`}
						>
							<p className={footerSplit ? 'text-center' : ''}>
								{libraryPage} of {libraryTotal}
								<span className="text-[#6e6e6e]"> · {progressPercent}%</span>
							</p>
							<p className="text-right">
								{pagesLeft} page{pagesLeft === 1 ? '' : 's'} left
							</p>
						</div>
						<div className="relative z-30 flex shrink-0 items-center gap-1">
							{isPdf ? fitToggleButton : null}
							{fullscreenButton}
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div ref={shellRef} className="reader-shell relative flex flex-col">
			<header className="relative shrink-0 px-16 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
				<Link
					to="/library"
					aria-label="Library"
					className="reader-nav absolute top-[max(1.25rem,env(safe-area-inset-top))] left-5 inline-flex items-center gap-1 text-xs"
				>
					<ArrowLeft size={14} />
					<span className="hidden sm:inline">Library</span>
				</Link>
				<p className="font-reader truncate text-center text-[12px] tracking-wide text-[#9a9a9a]">
					{book.title}
				</p>
				<div className="absolute top-[max(1.25rem,env(safe-area-inset-top))] right-5 flex items-center gap-3">
					{elapsedLabel}
					{timerRing}
					{offlineSaveButton}
					{bookmarkButton}
				</div>
			</header>

			<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
				<button
					type="button"
					className="reader-nav absolute inset-y-0 left-0 z-10 flex w-14 items-center justify-center"
					onClick={goPrev}
					disabled={!canPrev}
					aria-label="Previous pages"
				>
					<ChevronLeft size={28} strokeWidth={1.5} />
				</button>

				<div className="mx-auto flex min-h-0 w-full max-w-[1300px] flex-1 flex-col overflow-hidden px-10">
					<main className="min-h-0 flex-1 overflow-hidden py-3">{contentBody}</main>
					<footer
						className={`shrink-0 pt-2 pb-5 text-[12px] text-[#8a8a8a] ${
							footerSplit ? 'grid grid-cols-2' : 'flex justify-between'
						}`}
					>
						<p className={footerSplit ? 'text-center' : ''}>
							{libraryPage} of {libraryTotal}
							<span className="text-[#6e6e6e]"> · {progressPercent}%</span>
						</p>
						<p className="text-right">
							{pagesLeft} page{pagesLeft === 1 ? '' : 's'} left
						</p>
					</footer>
				</div>

				<button
					type="button"
					className="reader-nav absolute inset-y-0 right-0 z-10 flex w-14 items-center justify-center"
					onClick={goNext}
					disabled={!canNext}
					aria-label="Next pages"
				>
					<ChevronRight size={28} strokeWidth={1.5} />
				</button>
			</div>

			<div className="absolute right-4 bottom-4 z-20">{fullscreenButton}</div>
		</div>
	);
}
