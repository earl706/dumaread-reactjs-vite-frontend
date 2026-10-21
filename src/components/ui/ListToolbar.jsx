import { Search } from 'lucide-react';

import { cn } from '../../lib/format';
import { Select } from './Field';

/**
 * @param {object} props
 * @param {string} [props.search]
 * @param {(value: string) => void} [props.onSearchChange]
 * @param {string} [props.searchPlaceholder]
 * @param {string} [props.ordering]
 * @param {(value: string) => void} [props.onOrderingChange]
 * @param {{ value: string, label: string }[]} [props.sortOptions]
 * @param {{ key: string, label: string, value: string, onChange: (v: string) => void, options: { value: string, label: string }[] }[]} [props.filters]
 * @param {string} [props.className]
 */
export function ListToolbar({
	search = '',
	onSearchChange,
	searchPlaceholder = 'Search…',
	ordering = '',
	onOrderingChange,
	sortOptions = [],
	filters = [],
	className
}) {
	return (
		<div
			className={cn('mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end', className)}
		>
			{onSearchChange && (
				<div className="relative min-w-[12rem] flex-1 lg:max-w-xs">
					<Search
						size={16}
						className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
					/>
					<input
						type="search"
						value={search}
						onChange={(e) => onSearchChange(e.target.value)}
						placeholder={searchPlaceholder}
						className="border-line bg-surface text-fg placeholder:text-muted focus:border-primary w-full rounded-md border py-2 pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
					/>
				</div>
			)}
			<div className="flex flex-wrap gap-2">
				{sortOptions.length > 0 && onOrderingChange && (
					<Select
						label="Sort"
						value={ordering}
						onChange={(e) => onOrderingChange(e.target.value)}
						className="min-w-[10rem]"
					>
						{sortOptions.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</Select>
				)}
				{filters.map((filter) => (
					<Select
						key={filter.key}
						label={filter.label}
						value={filter.value}
						onChange={(e) => filter.onChange(e.target.value)}
						className="min-w-[10rem]"
					>
						{filter.options.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</Select>
				))}
			</div>
		</div>
	);
}
