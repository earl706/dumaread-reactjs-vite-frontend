import { BookOpen } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import { GoalProgressRings, LOAD_FADE, ProgressBar, Skeleton } from '../ui';
import { useCoverSrc } from './BookCard';

export function RecentBookShortcut({ book, onOpen }) {
	const { src, tried } = useCoverSrc(book);
	const title = book.title || 'Untitled';
	const loading = book.format !== 'txt' && !tried && !src;

	return (
		<button
			type="button"
			onClick={() => onOpen(book)}
			className="group flex h-full w-[calc((100%-4rem)/5)] min-w-[5.5rem] shrink-0 cursor-pointer flex-col text-left"
			aria-label={`Read ${title}`}
		>
			<div className="bg-surface-2 relative min-h-0 w-full flex-1 overflow-hidden rounded-md">
				<AnimatePresence mode="sync">
					{src ? (
						<motion.img
							key={src}
							src={src}
							alt=""
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={LOAD_FADE}
							className="absolute inset-0 h-full w-full object-cover"
						/>
					) : loading ? (
						<Skeleton key="cover-loading" className="absolute inset-0 h-full w-full rounded-none" />
					) : (
						<motion.div
							key="cover-empty"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={LOAD_FADE}
							className="text-muted absolute inset-0 flex h-full items-center justify-center"
						>
							<BookOpen size={20} strokeWidth={1.5} />
						</motion.div>
					)}
				</AnimatePresence>
				<div className="pointer-events-none absolute top-1 right-1 z-10 rounded-full bg-black/45 p-0.5 backdrop-blur-sm">
					<GoalProgressRings progress={book.goal_progress} size={32} stroke={2.5} gap={2} />
				</div>
			</div>
			<p className="text-fg mt-1 line-clamp-3 shrink-0 text-sm leading-snug font-medium break-words group-hover:underline">
				{title}
			</p>
			<ProgressBar value={book.progress_percent || 0} className="mt-1 shrink-0" />
		</button>
	);
}
