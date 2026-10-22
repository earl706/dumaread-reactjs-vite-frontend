import { useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';

import { formatLabel } from '../../lib/reading';
import { Skeleton } from '../ui';

function pageLabel(format, pageCount) {
	if (pageCount == null || pageCount < 1) return null;
	const noun = pageCount === 1 ? 'page' : 'pages';
	if (format === 'pdf') return `${pageCount} ${noun}`;
	return `≈ ${pageCount} ${noun}`;
}

export function UploadPreview({ status, coverUrl, format, pageCount }) {
	const [broken, setBroken] = useState(false);
	const loading = status === 'loading';
	const showImage = Boolean(coverUrl) && !broken && !loading;
	const pages = pageLabel(format, pageCount);

	return (
		<div
			className="border-line bg-surface-2 flex gap-3 rounded-md border p-3"
			aria-busy={loading}
			aria-live="polite"
		>
			<div className="bg-surface relative h-28 w-20 shrink-0 overflow-hidden rounded-sm">
				{loading ? (
					<Skeleton className="h-full w-full rounded-none" />
				) : showImage ? (
					<img
						src={coverUrl}
						alt=""
						className="h-full w-full object-cover"
						onError={() => setBroken(true)}
					/>
				) : (
					<div className="text-muted flex h-full w-full items-center justify-center">
						<BookOpen size={22} strokeWidth={1.5} aria-hidden />
					</div>
				)}
			</div>
			<div className="min-w-0 flex-1 self-center">
				{loading ? (
					<p className="text-muted flex items-center gap-2 text-sm">
						<Loader2 size={14} className="animate-spin" aria-hidden />
						Reading this file…
					</p>
				) : (
					<>
						<p className="text-fg text-sm font-medium">{formatLabel(format)}</p>
						{pages ? <p className="text-muted mt-0.5 text-sm">{pages}</p> : null}
					</>
				)}
			</div>
		</div>
	);
}
