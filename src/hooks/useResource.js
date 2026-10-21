import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { del, get, patch, post } from '../lib/api';
import { toast } from '../stores/toastStore';

/**
 * Factory that builds a small set of TanStack Query hooks for a REST resource.
 *
 *   const books = createResourceHooks('books', '/books/')
 *   books.useList({ status: 'reading' })
 *   books.useCreate(), books.useUpdate(), books.useRemove()
 *
 * Mutations always invalidate the resource cache; caller onSuccess/onError
 * run afterwards so pages can toast without dropping the refresh.
 */
export function createResourceHooks(key, basePath) {
	const listKey = (params) => [key, 'list', params || {}];
	const detailKey = (id) => [key, 'detail', id];

	function useList(params, options = {}) {
		return useQuery({
			queryKey: listKey(params),
			queryFn: () => get(basePath, { params }),
			...options
		});
	}

	function useDetail(id, options = {}) {
		return useQuery({
			queryKey: detailKey(id),
			queryFn: () => get(`${basePath}${id}/`),
			enabled: id != null,
			...options
		});
	}

	function useCreate(options = {}) {
		const qc = useQueryClient();
		const { onSuccess, onError, ...rest } = options;
		return useMutation({
			mutationFn: (body) => post(basePath, body),
			onSuccess: (...args) => {
				qc.invalidateQueries({ queryKey: [key] });
				onSuccess?.(...args);
			},
			onError: (...args) => {
				if (!onError) toast.error('Could not save changes.');
				onError?.(...args);
			},
			...rest
		});
	}

	function useUpdate(options = {}) {
		const qc = useQueryClient();
		const { onSuccess, onError, ...rest } = options;
		return useMutation({
			mutationFn: ({ id, ...body }) => patch(`${basePath}${id}/`, body),
			onSuccess: (...args) => {
				qc.invalidateQueries({ queryKey: [key] });
				onSuccess?.(...args);
			},
			onError: (...args) => {
				if (!onError) toast.error('Could not save changes.');
				onError?.(...args);
			},
			...rest
		});
	}

	function useRemove(options = {}) {
		const qc = useQueryClient();
		const { onSuccess, onError, ...rest } = options;
		return useMutation({
			mutationFn: (id) => del(`${basePath}${id}/`),
			onSuccess: (...args) => {
				qc.invalidateQueries({ queryKey: [key] });
				onSuccess?.(...args);
			},
			onError: (...args) => {
				if (!onError) toast.error('Could not delete.');
				onError?.(...args);
			},
			...rest
		});
	}

	return { key, basePath, listKey, detailKey, useList, useDetail, useCreate, useUpdate, useRemove };
}
