import { useEffect, useState } from 'react';
import { BookOpen, Clock, Download, Info, Pencil, Trash2, WifiOff } from 'lucide-react';

import { booksApi } from '../../lib/resources';
import { formatLabel } from '../../lib/reading';
import { STATUS_LABELS } from '../../lib/status';
import { formatDurationSeconds } from '../../lib/format';
import { useOfflineStore } from '../../stores/offlineStore';
import {
	CoverCard,
	GoalProgressRings,
	ProgressBar,
	Skeleton,
	formatGoalProgressTooltip
} from '../ui';

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

export function BookCard({ book, onRead, onEdit, onInfo, onDelete, onGoals, onToggleOffline }) {
	const { src, tried } = useCoverSrc(book);
	const title = book.title || 'Untitled';
	const loading = book.format !== 'txt' && !tried && !src;
	const savedOffline = useOfflineStore((s) => s.savedIds.includes(Number(book.id)));

	const actions = [
		...(typeof onInfo === 'function'
			? [{ icon: Info, label: `Info for ${title}`, onClick: () => onInfo(book) }]
			: []),
		...(typeof onEdit === 'function'
			? [{ icon: Pencil, label: `Edit ${title}`, onClick: () => onEdit(book) }]
			: []),
		...(typeof onToggleOffline === 'function'
			? [
					{
						icon: savedOffline ? WifiOff : Download,
						label: savedOffline ? `Remove ${title} from offline` : `Save ${title} for offline`,
						onClick: () => onToggleOffline(book, savedOffline)
					}
				]
			: []),
		...(typeof onDelete === 'function'
			? [
					{
						icon: Trash2,
						label: `Delete ${title}`,
						onClick: () => onDelete(book),
						tone: 'danger'
					}
				]
			: [])
	];

	const goalsLabel = `Reading goals for ${title}`;
	const configuredTooltip = formatGoalProgressTooltip(book.goal_progress);
	const goalsTooltip =
		configuredTooltip || formatGoalProgressTooltip(book.goal_progress, { requireGoal: false });
	const goalsTooltipLines = goalsTooltip ? goalsTooltip.split('\n') : [];

	const goalsTip = goalsTooltipLines.length ? (
		<div
			role="tooltip"
			className="goals-tip pointer-events-none absolute top-full right-0 z-50 mt-1.5 min-w-max rounded-md bg-black/90 px-2 py-1.5 text-left text-[10px] leading-snug text-white opacity-0 shadow-lg transition-opacity duration-100"
		>
			{!configuredTooltip ? (
				<div className="mb-1 whitespace-nowrap text-white/70">No goals set</div>
			) : null}
			{goalsTooltipLines.map((line) => (
				<div key={line} className="whitespace-nowrap tabular-nums">
					{line}
				</div>
			))}
		</div>
	) : null;

	const goalsBadgeClass =
		'relative rounded-full bg-black/45 p-0.5 backdrop-blur-sm [&:hover>.goals-tip]:opacity-100 [&:focus-visible>.goals-tip]:opacity-100 [&:focus-within>.goals-tip]:opacity-100';

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
						className={`cursor-pointer transition hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${goalsBadgeClass}`}
						aria-label={goalsLabel}
					>
						<GoalProgressRings
							progress={book.goal_progress}
							size={40}
							stroke={3}
							title={goalsLabel}
						/>
						{goalsTip}
					</button>
				) : (
					<div className={goalsBadgeClass}>
						<GoalProgressRings
							progress={book.goal_progress}
							size={40}
							stroke={3}
							title={goalsLabel}
						/>
						{goalsTip}
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
