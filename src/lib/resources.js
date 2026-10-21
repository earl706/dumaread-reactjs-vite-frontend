import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createResourceHooks } from '../hooks/useResource';
import { get, getBlob, post } from './api';

const booksHooks = createResourceHooks('books', '/books/');

/** Book CRUD + activity heatmap, stats, heartbeat, and file/text loaders. */
export const booksApi = {
	...booksHooks,
	useActivity(params = {}, options = {}) {
		return useQuery({
			queryKey: [booksHooks.key, 'activity', params],
			queryFn: () => get(`${booksHooks.basePath}activity/`, { params }),
			...options
		});
	},
	useStats(options = {}) {
		return useQuery({
			queryKey: [booksHooks.key, 'stats'],
			queryFn: () => get(`${booksHooks.basePath}stats/`),
			...options
		});
	},
	useHeartbeat(options = {}) {
		const qc = useQueryClient();
		return useMutation({
			mutationFn: ({ id, current_page, seconds }) =>
				post(`${booksHooks.basePath}${id}/heartbeat/`, { current_page, seconds }),
			onSuccess: (data, vars) => {
				qc.invalidateQueries({ queryKey: [booksHooks.key] });
				if (vars?.id && data) {
					qc.setQueryData(booksHooks.detailKey(vars.id), data);
				}
			},
			...options
		});
	},
	fetchFile(id) {
		return getBlob(`${booksHooks.basePath}${id}/file/`);
	},
	fetchText(id) {
		return get(`${booksHooks.basePath}${id}/text/`);
	}
};
