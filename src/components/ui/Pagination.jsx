import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '../../lib/format';

function buildPageNumbers(page, totalPages) {
	if (totalPages <= 7) {
		return Array.from({ length: totalPages }, (_, i) => i + 1);
	}
	const pages = new Set([1, totalPages, page, page - 1, page + 1]);
	return [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
}

export function Pagination({ page = 1, totalPages = 1, count = 0, pageSize = 10, onPageChange }) {
	if (count <= pageSize) return null;

	const pages = buildPageNumbers(page, totalPages);
	const from = (page - 1) * pageSize + 1;
	const to = Math.min(page * pageSize, count);

	return (
		<div className="border-line mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
			<p className="text-muted text-sm">
				{from}–{to} of {count}
			</p>
			<div className="flex flex-wrap items-center gap-1">
				<button
					type="button"
					disabled={page <= 1}
					onClick={() => onPageChange(page - 1)}
					className="border-line text-muted hover:text-fg flex h-9 cursor-pointer items-center gap-1 rounded-md border px-2.5 text-sm disabled:cursor-default disabled:opacity-40"
					aria-label="Previous page"
				>
					<ChevronLeft size={16} />
					Prev
				</button>
				{pages.map((p, i) => {
					const prev = pages[i - 1];
					const gap = prev != null && p - prev > 1;
					return (
						<span key={p} className="inline-flex items-center gap-1">
							{gap && <span className="text-muted px-1 text-sm">…</span>}
							<button
								type="button"
								onClick={() => onPageChange(p)}
								className={cn(
									'h-9 min-w-9 cursor-pointer rounded-md border px-2 text-sm font-medium disabled:cursor-default',
									p === page
										? 'border-primary bg-primary/10 text-primary'
										: 'border-line text-fg hover:bg-surface-2'
								)}
								aria-current={p === page ? 'page' : undefined}
							>
								{p}
							</button>
						</span>
					);
				})}
				<button
					type="button"
					disabled={page >= totalPages}
					onClick={() => onPageChange(page + 1)}
					className="border-line text-muted hover:text-fg flex h-9 cursor-pointer items-center gap-1 rounded-md border px-2.5 text-sm disabled:cursor-default disabled:opacity-40"
					aria-label="Next page"
				>
					Next
					<ChevronRight size={16} />
				</button>
			</div>
		</div>
	);
}
