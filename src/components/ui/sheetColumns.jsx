/** Shared column helpers for Table and DataSheet. */

export const NON_SORTABLE_TYPES = new Set(['actions', 'action-link']);

export function columnSortKey(col) {
	if (!col || col.sortable === false || NON_SORTABLE_TYPES.has(col.type)) return null;
	return col.sortKey || col.key || null;
}

export function parseOrdering(ordering) {
	if (!ordering) return { key: '', dir: null };
	if (String(ordering).startsWith('-')) return { key: ordering.slice(1), dir: 'desc' };
	return { key: ordering, dir: 'asc' };
}

/** none/other → asc → desc → defaultOrdering (default-desc columns flip to asc first). */
export function nextOrdering(current, sortKey, defaultOrdering = '') {
	const asc = sortKey;
	const desc = `-${sortKey}`;
	if (current === asc) return desc;
	if (current === desc) return current === defaultOrdering ? asc : defaultOrdering;
	return asc;
}

export function SortIndicator({ direction }) {
	return (
		<span className="inline-flex shrink-0 flex-col leading-none" aria-hidden>
			<span className={`text-[7px] ${direction === 'asc' ? 'text-fg' : 'text-muted/35'}`}>▲</span>
			<span className={`-mt-px text-[7px] ${direction === 'desc' ? 'text-fg' : 'text-muted/35'}`}>
				▼
			</span>
		</span>
	);
}

export function StatusDot({ status, tones }) {
	const map = tones || { active: 'bg-primary', archived: 'bg-muted' };
	const tone = map[status] || 'bg-muted';
	return (
		<span
			className={`inline-block h-2 w-2 shrink-0 rounded-full ${tone}`}
			title={status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
			aria-label={status || 'unknown'}
		/>
	);
}
