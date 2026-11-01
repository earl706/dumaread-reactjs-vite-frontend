import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

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
import { toast } from '../stores/toastStore';
import { selectIntervalActive } from '../stores/createTimerStore';
import { readingTimer } from '../stores/readingTimer';
import { useReadingSession } from '../hooks/useReadingSession';
import { EpubReader } from '../components/books/EpubReader';
import { Button, EmptyState, LoadingScreen, ProgressRing } from '../components/ui';

GlobalWorkerOptions.workerSrc = pdfWorker;

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

function PdfCanvas({ pdf, pageNumber }) {
	const canvasRef = useRef(null);
	const [error, setError] = useState('');
	const [frame, setFrame] = useState(0);

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
				const scale = Math.min(maxWidth / base.width, maxHeight / base.height);
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
	}, [pdf, pageNumber, frame]);

	if (error) {
		return <p className="p-8 text-center text-sm text-red-400">{error}</p>;
	}
	return <canvas ref={canvasRef} className="mx-auto max-h-full max-w-full bg-white shadow-sm" />;
}

function PdfSpread({ data, leftPage, rightPage, twoPage }) {
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
					<PdfCanvas pdf={pdf} pageNumber={leftPage} />
				) : (
					<LoadingScreen label="Rendering PDF…" />
				)}
			</div>
			{twoPage ? (
				<div className="reader-page flex items-center justify-center">
					{pdf && rightPage ? <PdfCanvas pdf={pdf} pageNumber={rightPage} /> : null}
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
	const { data: book, isLoading, isError } = booksApi.useDetail(id);
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
	const [elapsed, setElapsed] = useState(0);
	const [isFullscreen, setIsFullscreen] = useState(false);

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
				if (isPdf || isEpub) {
					const blob = await booksApi.fetchFile(book.id);
					const buf = await blob.arrayBuffer();
					if (!cancelled) setFileBytes(buf);
				} else {
					const payload = await booksApi.fetchText(book.id);
					if (!cancelled) setText(payload.text || '');
				}
				if (!cancelled) setContentReady(true);
			} catch {
				if (!cancelled) setLoadError('Could not load this book.');
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [book?.id, isPdf, isEpub]);

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

	if (isLoading) {
		return (
			<div className="reader-shell flex items-center justify-center">
				<LoadingScreen label="Opening book…" />
			</div>
		);
	}
	if (isError || !book) {
		return (
			<div className="reader-shell flex items-center justify-center p-8">
				<EmptyState
					title="Book not found"
					description="This book is missing or you do not have access."
					action={
						<Link to="/library">
							<Button variant="secondary">Back to library</Button>
						</Link>
					}
				/>
			</div>
		);
	}

	const spreadClass = isEpub
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
	const toggleBookmark = () => {
		if (bookmarkBook.isPending || page == null) return;
		if (hasBookmark) {
			bookmarkBook.mutate({ id: book.id, page: null });
			return;
		}
		bookmarkBook.mutate({ id: book.id, page: trackedPage });
	};

	return (
		<div ref={shellRef} className="reader-shell relative flex flex-col">
			<header className="relative shrink-0 px-16 pt-5 pb-2">
				<Link
					to="/library"
					aria-label="Library"
					className="reader-nav absolute top-5 left-5 inline-flex items-center gap-1 text-xs"
				>
					<ArrowLeft size={14} />
					<span className="hidden sm:inline">Library</span>
				</Link>
				<p className="font-reader truncate text-center text-[12px] tracking-wide text-[#9a9a9a]">
					{book.title}
				</p>
				<div className="absolute top-5 right-5 flex items-center gap-3">
					<p className="hidden text-[11px] text-[#6e6e6e] sm:block">
						{formatDurationSeconds(elapsed)}
						{book.total_reading_seconds
							? ` · ${formatDurationSeconds(book.total_reading_seconds)} total`
							: ''}
					</p>
					{timerSessionActive ? (
						<div
							className="inline-flex items-center justify-center"
							role="img"
							aria-label={`Reading timer ${timerDisplay} remaining`}
							title={`Reading timer ${timerDisplay} remaining`}
						>
							<ProgressRing
								value={timerRemainingPct}
								size={28}
								stroke={3}
								tone="primary"
								label=""
							/>
						</div>
					) : null}
					<button
						type="button"
						className={`inline-flex items-center justify-center disabled:opacity-50 ${
							onBookmarkedPage ? 'text-primary' : 'reader-nav'
						}`}
						style={onBookmarkedPage ? { color: 'var(--primary)' } : undefined}
						onClick={toggleBookmark}
						disabled={bookmarkBook.isPending || page == null}
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
					<main className="min-h-0 flex-1 overflow-hidden py-3">
						{loadError ? (
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
									/>
								) : (
									<TextSpread
										pages={textPages}
										leftPage={leftPage}
										rightPage={rightPage}
										twoPage={twoPage}
									/>
								)}
							</div>
						)}
					</main>
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

			<button
				type="button"
				className="reader-nav absolute right-4 bottom-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-md"
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
		</div>
	);
}
