import { STORES, withStore, withStores } from './db';

/**
 * @param {{ userId: string|number, bookId: string|number, current_page: number, seconds: number }} row
 */
export async function enqueueHeartbeat(row) {
	const seconds = Math.max(0, Math.min(120, Math.floor(Number(row.seconds) || 0)));
	if (!seconds && !row.current_page) return null;
	const entry = {
		userId: String(row.userId),
		bookId: Number(row.bookId),
		current_page: Math.max(1, Math.floor(Number(row.current_page) || 1)),
		seconds,
		clientTs: Date.now(),
		status: 'pending'
	};
	return withStore(STORES.outbox, 'readwrite', (store, toPromise) => toPromise(store.add(entry)));
}

export async function listPendingOutbox(userId) {
	const uid = String(userId);
	return withStore(STORES.outbox, 'readonly', async (store, toPromise) => {
		const all = await toPromise(store.getAll());
		return (all || [])
			.filter((row) => String(row.userId) === uid && row.status !== 'done')
			.sort((a, b) => (a.clientTs || 0) - (b.clientTs || 0) || a.id - b.id);
	});
}

export async function sumPendingSeconds(userId, bookId = null) {
	const rows = await listPendingOutbox(userId);
	return rows.reduce((sum, row) => {
		if (bookId != null && Number(row.bookId) !== Number(bookId)) return sum;
		return sum + (Number(row.seconds) || 0);
	}, 0);
}

export async function pendingSecondsByBook(userId) {
	const rows = await listPendingOutbox(userId);
	const map = {};
	for (const row of rows) {
		const id = Number(row.bookId);
		map[id] = (map[id] || 0) + (Number(row.seconds) || 0);
	}
	return map;
}

export async function hasPendingForBook(userId, bookId) {
	const rows = await listPendingOutbox(userId);
	return rows.some((row) => Number(row.bookId) === Number(bookId));
}

export async function markOutboxSending(id) {
	return withStore(STORES.outbox, 'readwrite', async (store, toPromise) => {
		const row = await toPromise(store.get(id));
		if (!row) return null;
		row.status = 'sending';
		await toPromise(store.put(row));
		return row;
	});
}

export async function markOutboxPending(id) {
	return withStore(STORES.outbox, 'readwrite', async (store, toPromise) => {
		const row = await toPromise(store.get(id));
		if (!row) return null;
		row.status = 'pending';
		await toPromise(store.put(row));
		return row;
	});
}

export async function deleteOutboxRow(id) {
	return withStore(STORES.outbox, 'readwrite', (store, toPromise) => toPromise(store.delete(id)));
}

/** Reset any stuck "sending" rows back to pending (e.g. after crash). */
export async function resetSendingOutbox(userId) {
	const uid = String(userId);
	return withStores([STORES.outbox], 'readwrite', async (stores, toPromise) => {
		const store = stores[STORES.outbox];
		const all = await toPromise(store.getAll());
		for (const row of all || []) {
			if (String(row.userId) === uid && row.status === 'sending') {
				row.status = 'pending';
				await toPromise(store.put(row));
			}
		}
	});
}
