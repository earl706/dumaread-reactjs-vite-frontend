import { BookOpen } from 'lucide-react';

import { ProgressBar, Skeleton } from '../ui';
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
				{src ? (
					<img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
				) : loading ? (
					<Skeleton className="h-full w-full rounded-none" />
				) : (
					<div className="text-muted flex h-full items-center justify-center">
						<BookOpen size={20} strokeWidth={1.5} />
					</div>
				)}
			</div>
			<p className="text-fg mt-1 line-clamp-3 shrink-0 text-sm leading-snug font-medium break-words group-hover:underline">
				{title}
			</p>
			<ProgressBar value={book.progress_percent || 0} className="mt-1 shrink-0" />
		</button>
	);
}
