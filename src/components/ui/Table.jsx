import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

import { cn } from '../../lib/format';
import {
	columnSortKey,
	nextOrdering,
	parseOrdering,
	SortIndicator,
	StatusDot
} from './sheetColumns';

/**
 * Compact read-only table. Same column shape as DataSheet so one columns[]
 * can drive both: use Table on VITE_MOBILE / narrow surfaces; DataSheet on
 * desktop for inline edit + fill handle.
 *
 * Column fields: key, label, type, render, getDisplay, align, className,
 * sortable, sortKey, linkTo, linkAriaLabel, statusTones.
 * Types: default text, status-icon, action-link.
 * Pass ordering + onOrderingChange for Wikipedia-style header sort.
 * onRowClick(row) for tappable iOS lists; getRowTo(row) wraps the row in Link.
 */
export function Table({
	rows,
	columns,
	ordering = '',
	defaultOrdering = '',
	onOrderingChange,
	selectable = false,
	onSelectionChange,
	onRowClick,
	getRowTo,
	emptyMessage = 'No rows.',
	compact = true,
	rowLabel = (row) => row.title || 'row'
}) {
	const [selectedIds, setSelectedIds] = useState(() => new Set());
	const rowIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);

	useEffect(() => {
		setSelectedIds((prev) => {
			const next = new Set([...prev].filter((id) => rowIds.has(id)));
			return next.size === prev.size ? prev : next;
		});
	}, [rowIds]);

	useEffect(() => {
		onSelectionChange?.(Array.from(selectedIds));
	}, [selectedIds, onSelectionChange]);

	const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
	const someSelected = rows.some((r) => selectedIds.has(r.id));

	const toggleRow = (id) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const toggleAll = () => {
		if (allSelected) {
			setSelectedIds(new Set());
			return;
		}
		setSelectedIds(new Set(rows.map((r) => r.id)));
	};

	const displayCell = (row, col) => {
		if (col.type === 'status-icon') {
			return <StatusDot status={row[col.key]} tones={col.statusTones} />;
		}
		if (col.render) return col.render(row);
		const raw = col.getDisplay ? col.getDisplay(row) : row[col.key];
		if (raw == null || raw === '') return <span className="text-muted/50">—</span>;
		return raw;
	};

	const cellText = compact ? 'text-xs' : 'text-sm';
	const headText = compact ? 'text-[10px]' : 'text-xs';
	const cellPad = compact ? 'px-1.5 py-1' : 'px-2 py-2';
	const headPad = compact ? 'px-1.5 py-1.5' : 'px-2 py-2';

	return (
		<div className="border-line bg-surface overflow-x-auto rounded-md border">
			<table className={cn('w-full table-fixed border-collapse', cellText)}>
				<thead>
					<tr className="bg-surface-2 border-line border-b">
						{selectable && (
							<th scope="col" className={cn('w-8', headPad)}>
								<input
									type="checkbox"
									className="accent-primary h-3.5 w-3.5 cursor-pointer"
									checked={allSelected}
									ref={(el) => {
										if (el) el.indeterminate = someSelected && !allSelected;
									}}
									onChange={toggleAll}
									aria-label="Select all rows"
								/>
							</th>
						)}
						{columns.map((col) => {
							const sortKey = onOrderingChange ? columnSortKey(col) : null;
							const { key: activeKey, dir } = parseOrdering(ordering);
							const active = Boolean(sortKey && activeKey === sortKey);
							const ariaSort = !sortKey
								? undefined
								: active
									? dir === 'desc'
										? 'descending'
										: 'ascending'
									: 'none';
							const sortLabel = col.label || col.key;
							return (
								<th
									key={col.key}
									scope="col"
									aria-sort={ariaSort}
									className={cn(
										'text-muted font-semibold tracking-wide uppercase',
										headText,
										headPad,
										col.align === 'right' && 'text-right',
										col.className
									)}
								>
									{sortKey ? (
										<button
											type="button"
											className={cn(
												'inline-flex max-w-full cursor-pointer items-center gap-0.5 select-none',
												col.align === 'right' && 'ml-auto',
												active ? 'text-fg' : 'hover:text-fg'
											)}
											onClick={() =>
												onOrderingChange(nextOrdering(ordering, sortKey, defaultOrdering))
											}
											aria-label={`Sort by ${sortLabel}`}
										>
											{col.label ? <span className="min-w-0 truncate">{col.label}</span> : null}
											<SortIndicator direction={active ? dir : null} />
										</button>
									) : (
										<span className="truncate">{col.label}</span>
									)}
								</th>
							);
						})}
					</tr>
				</thead>
				<tbody>
					{rows.length === 0 ? (
						<tr>
							<td
								colSpan={columns.length + (selectable ? 1 : 0)}
								className="text-muted px-3 py-8 text-center text-sm"
							>
								{emptyMessage}
							</td>
						</tr>
					) : (
						rows.map((row) => {
							const selected = selectedIds.has(row.id);
							const to = getRowTo?.(row);
							const clickable = Boolean(onRowClick || to);
							return (
								<tr
									key={row.id}
									data-row-id={row.id}
									className={cn(
										'border-line border-b last:border-b-0',
										selected ? 'bg-primary/8' : 'hover:bg-surface-2/60',
										clickable && 'cursor-pointer'
									)}
									onClick={
										onRowClick
											? (e) => {
													if (e.target.closest('a, button, input')) return;
													onRowClick(row);
												}
											: undefined
									}
								>
									{selectable && (
										<td className={cn('w-8 text-center', cellPad)}>
											<input
												type="checkbox"
												className="accent-primary h-3.5 w-3.5 cursor-pointer"
												onChange={() => toggleRow(row.id)}
												checked={selected}
												aria-label={`Select ${rowLabel(row)}`}
											/>
										</td>
									)}
									{columns.map((col) => {
										if (col.type === 'action-link') {
											const href = col.linkTo?.(row);
											return (
												<td
													key={col.key}
													className={cn('px-0.5 py-0.5 text-center', col.className)}
												>
													{href ? (
														<Link
															to={href}
															className="text-muted hover:text-fg hover:bg-surface-2 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md"
															aria-label={col.linkAriaLabel?.(row) || `Open ${rowLabel(row)}`}
														>
															<ExternalLink size={14} />
														</Link>
													) : null}
												</td>
											);
										}

										const shown = displayCell(row, col);
										const inner = to ? (
											<Link to={to} className="text-inherit no-underline">
												{shown}
											</Link>
										) : (
											shown
										);

										return (
											<td
												key={col.key}
												className={cn(
													'text-fg truncate',
													cellPad,
													col.align === 'right' && 'text-right tabular-nums',
													col.type === 'status-icon' && 'text-center',
													col.className
												)}
											>
												{inner}
											</td>
										);
									})}
								</tr>
							);
						})
					)}
				</tbody>
			</table>
		</div>
	);
}
