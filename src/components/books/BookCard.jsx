import { useEffect, useState } from 'react';
import { BookOpen, Clock, Info, Pencil, Trash2 } from 'lucide-react';

import { booksApi } from '../../lib/resources';
import { formatLabel } from '../../lib/reading';
import { STATUS_LABELS } from '../../lib/status';
import { formatDurationSeconds } from '../../lib/format';
import { CoverCard, GoalProgressRings, ProgressBar, Skeleton } from '../ui';

export function useCoverSrc(book) {
	const [src, setSrc] = useState(null);
	const [tried, setTried] = useState(book.format === 'txt');

	useEffect(() => {
		if (book.format === 'txt') {
			setSrc(null);
			setTried(true);
			return undefined;
		}
		let url;
		let cancelled = false;
		setSrc(null);
		setTried(false);
		booksApi
			.fetchCover(book.id)
			.then((blob) => {
				if (cancelled || !blob || blob.size === 0) return;
				url = URL.createObjectURL(blob);
				setSrc(url);
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) setTried(true);
			});
		return () => {
			cancelled = true;
			if (url) URL.revokeObjectURL(url);
		};
	}, [book.id, book.format, book.has_cover]);

	return { src, tried };
}

export function BookCard({ book, onRead, onEdit, onInfo, onDelete, onGoals }) {
	const { src, tried } = useCoverSrc(book);
	const title = book.title || 'Untitled';
	const loading = book.format !== 'txt' && !tried && !src;

	const actions = [
		{ icon: Info, label: `Info for ${title}`, onClick: () => onInfo(book) },
		{ icon: Pencil, label: `Edit ${title}`, onClick: () => onEdit(book) },
		{
			icon: Trash2,
			label: `Delete ${title}`,
			onClick: () => onDelete(book),
			tone: 'danger'
		}
	];

	const goalsLabel = `Reading goals for ${title}`;

	return (
		<CoverCard
			title={title}
			subtitle={book.author || 'Unknown author'}
			imageSrc={src}
			fallbackIcon={BookOpen}
			fallback={loading ? <Skeleton className="h-full w-full rounded-none" /> : undefined}
			onOpen={() => onRead(book)}
			openLabel={`Read ${title}`}
			coverClassName="h-64"
			coverBadge={
				typeof onGoals === 'function' ? (
					<button
						type="button"
						onClick={() => onGoals(book)}
						className="cursor-pointer rounded-full bg-black/45 p-0.5 backdrop-blur-sm transition hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
						aria-label={goalsLabel}
						title={goalsLabel}
					>
						<GoalProgressRings progress={book.goal_progress} size={40} stroke={3} />
					</button>
				) : (
					<div className="rounded-full bg-black/45 p-0.5 backdrop-blur-sm">
						<GoalProgressRings progress={book.goal_progress} size={40} stroke={3} />
					</div>
				)
			}
			stats={[
				{ value: STATUS_LABELS[book.status] || book.status, label: 'Status' },
				{ value: formatLabel(book.format), label: 'Format' },
				{
					icon: Clock,
					value: formatDurationSeconds(book.total_reading_seconds) || '0s',
					label: 'Time read'
				}
			]}
			actions={actions}
			primaryAction={{
				icon: BookOpen,
				label: `Read ${title}`,
				onClick: () => onRead(book)
			}}
			footer={<ProgressBar value={book.progress_percent || 0} />}
		/>
	);
}
