import { useCallback, useEffect, useMemo, useState } from 'react';

export const LIST_PAGE_SIZE = 10;

export function useListControls({ defaultOrdering = '', defaultFilters = {} } = {}) {
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');
	const [debouncedSearch, setDebouncedSearch] = useState('');
	const [ordering, setOrdering] = useState(defaultOrdering);
	const [filters, setFilters] = useState(defaultFilters);

	useEffect(() => {
		const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
		return () => window.clearTimeout(id);
	}, [search]);

	useEffect(() => {
		setPage(1);
	}, [debouncedSearch, ordering, filters]);

	const setFilter = useCallback((key, value) => {
		setFilters((current) => {
			const next = { ...current };
			if (value === '' || value == null) delete next[key];
			else next[key] = value;
			return next;
		});
	}, []);

	const queryParams = useMemo(
		() => ({
			page,
			page_size: LIST_PAGE_SIZE,
			...(debouncedSearch ? { search: debouncedSearch } : {}),
			...(ordering ? { ordering } : {}),
			...filters
		}),
		[page, debouncedSearch, ordering, filters]
	);

	return {
		page,
		setPage,
		search,
		setSearch,
		ordering,
		setOrdering,
		filters,
		setFilter,
		setFilters,
		queryParams,
		pageSize: LIST_PAGE_SIZE
	};
}

/** Client-side pagination for endpoints that return a full array. */
export function paginateClient(items, page, pageSize = LIST_PAGE_SIZE) {
	const count = items.length;
	const total_pages = Math.max(1, Math.ceil(count / pageSize));
	const safePage = Math.min(Math.max(1, page), total_pages);
	const start = (safePage - 1) * pageSize;
	return {
		results: items.slice(start, start + pageSize),
		count,
		total_pages,
		page: safePage,
		page_size: pageSize
	};
}
