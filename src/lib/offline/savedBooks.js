import { booksApi } from '../resources';
import { STORES, isQuotaExceeded, withStore, withStores } from './db';
import { hasPendingForBook } from './outbox';

function contentKey(userId, bookId) {
	return `${userId}:${bookId}`;
}

async function listSavedMeta(userId) {
	const uid = String(userId);
	return withStore(STORES.savedBooks, 'readonly', async (store, toPromise) => {
		const all = await toPromise(store.getAll());
		return (all || []).filter((row) => String(row.userId) === uid);
	});
}

export async function listSavedBookIds(userId) {
	const rows = await listSavedMeta(userId);
	return rows.map((row) => Number(row.bookId));
}

export async function isBookSaved(userId, bookId) {
	const uid = String(userId);
	const id = Number(bookId);
	const row = await withStore(STORES.savedBooks, 'readonly', (store, toPromise) =>
		toPromise(store.get(id))
	);
	return Boolean(row && String(row.userId) === uid);
}

export async function getSavedBookMeta(userId, bookId) {
	const uid = String(userId);
	const id = Number(bookId);
	const row = await withStore(STORES.savedBooks, 'readonly', (store, toPromise) =>
		toPromise(store.get(id))
	);
	if (!row || String(row.userId) !== uid) return null;
	return row;
}

export async function getSavedBookContent(userId, bookId) {
	const key = contentKey(userId, bookId);
	return withStore(STORES.bookContent, 'readonly', (store, toPromise) => toPromise(store.get(key)));
}

export async function getSavedBookCover(userId, bookId) {
	const key = contentKey(userId, bookId);
	return withStore(STORES.bookCovers, 'readonly', (store, toPromise) => toPromise(store.get(key)));
}

export async function touchSavedBook(userId, bookId) {
	const meta = await getSavedBookMeta(userId, bookId);
	if (!meta) return null;
	meta.lastAccessedAt = Date.now();
	await withStore(STORES.savedBooks, 'readwrite', (store, toPromise) => toPromise(store.put(meta)));
	return meta;
}

async function deleteSavedBookInternal(userId, bookId, { keepOutbox = true } = {}) {
	const uid = String(userId);
	const id = Number(bookId);
	const key = contentKey(uid, id);
	await withStores(
		[STORES.savedBooks, STORES.bookContent, STORES.bookCovers, STORES.progressBaseline],
		'readwrite',
		async (stores, toPromise) => {
			const meta = await toPromise(stores[STORES.savedBooks].get(id));
			if (meta && String(meta.userId) === uid) {
				await toPromise(stores[STORES.savedBooks].delete(id));
			}
			await toPromise(stores[STORES.bookContent].delete(key));
			await toPromise(stores[STORES.bookCovers].delete(key));
			await toPromise(stores[STORES.progressBaseline].delete(key));
		}
	);
	return { keepOutbox };
}

/** Oldest first by lastAccessedAt (fallback savedAt). */
async function oldestSavedExcluding(userId, excludeBookId) {
	const rows = await listSavedMeta(userId);
	return rows
		.filter((row) => Number(row.bookId) !== Number(excludeBookId))
		.sort((a, b) => (a.lastAccessedAt || a.savedAt || 0) - (b.lastAccessedAt || b.savedAt || 0));
}

async function writeSavedPayload(userId, payload) {
	const uid = String(userId);
	const id = Number(payload.meta.bookId);
	const key = contentKey(uid, id);
	await withStores(
		[
			STORES.savedBooks,
			STORES.bookContent,
			STORES.bookCovers,
			STORES.progressBaseline,
			STORES.userBaseline
		],
		'readwrite',
		async (stores, toPromise) => {
			await toPromise(stores[STORES.savedBooks].put(payload.meta));
			await toPromise(stores[STORES.bookContent].put(payload.content, key));
			if (payload.cover) {
				await toPromise(stores[STORES.bookCovers].put(payload.cover, key));
			}
			if (payload.progressBaseline) {
				await toPromise(stores[STORES.progressBaseline].put(payload.progressBaseline, key));
			}
			if (payload.userBaseline) {
				await toPromise(stores[STORES.userBaseline].put(payload.userBaseline, 'me:' + uid));
			}
		}
	);
}

/**
 * Save a book for offline reading. Evicts oldest saved books on quota pressure.
 * @returns {{ evicted: number }}
 */
export async function saveBookOffline(userId, book, { userBaseline, statsGoalProgress } = {}) {
	const uid = String(userId);
	const id = Number(book.id);
	const isTxt = book.format === 'txt';
	let content;
	let contentType;
	let byteLength = 0;

	if (isTxt) {
		const payload = await booksApi.fetchText(id);
		content = { text: payload.text || '' };
		contentType = 'text';
		byteLength = new Blob([content.text]).size;
	} else {
		const blob = await booksApi.fetchFile(id);
		content = await blob.arrayBuffer();
		contentType = 'file';
		byteLength = content.byteLength || 0;
	}

	let cover = null;
	if (book.format !== 'txt' && book.has_cover) {
		try {
			const coverBlob = await booksApi.fetchCover(id);
			if (coverBlob && coverBlob.size > 0) cover = coverBlob;
		} catch {
			/* optional */
		}
	}

	const now = Date.now();
	const meta = {
		bookId: id,
		userId: uid,
		title: book.title || 'Untitled',
		author: book.author || '',
		format: book.format,
		page_count: book.page_count || 1,
		current_page: book.current_page || 0,
		bookmark_page: book.bookmark_page ?? null,
		status: book.status,
		goal_daily_minutes: book.goal_daily_minutes ?? null,
		goal_weekly_minutes: book.goal_weekly_minutes ?? null,
		goal_monthly_minutes: book.goal_monthly_minutes ?? null,
		has_cover: Boolean(book.has_cover),
		total_reading_seconds: book.total_reading_seconds || 0,
		progress_percent: book.progress_percent || 0,
		savedAt: now,
		lastAccessedAt: now,
		contentType,
		byteLength
	};

	const progressBaseline = {
		userId: uid,
		bookId: id,
		goal_progress: book.goal_progress || null,
		current_page: book.current_page || 0,
		updatedAt: now
	};

	const userBaselinePayload = userBaseline || {
		userId: uid,
		goal_daily_minutes: null,
		goal_weekly_minutes: null,
		goal_monthly_minutes: null,
		goal_progress: statsGoalProgress || null,
		updatedAt: now
	};

	const payload = {
		meta,
		content,
		cover,
		progressBaseline,
		userBaseline: userBaselinePayload
	};

	let evicted = 0;
	for (;;) {
		try {
			await writeSavedPayload(uid, payload);
			return { evicted };
		} catch (err) {
			if (!isQuotaExceeded(err)) throw err;
			const victims = await oldestSavedExcluding(uid, id);
			if (!victims.length) throw err;
			await deleteSavedBookInternal(uid, victims[0].bookId);
			evicted += 1;
		}
	}
}

export async function removeBookOffline(userId, bookId) {
	if (await hasPendingForBook(userId, bookId)) {
		const err = new Error('pending_outbox');
		err.code = 'pending_outbox';
		throw err;
	}
	await deleteSavedBookInternal(userId, bookId);
}

export async function setProgressBaseline(userId, bookId, baseline) {
	const key = contentKey(userId, bookId);
	await withStore(STORES.progressBaseline, 'readwrite', (store, toPromise) =>
		toPromise(store.put({ ...baseline, userId: String(userId), bookId: Number(bookId) }, key))
	);
}

export async function getProgressBaseline(userId, bookId) {
	const key = contentKey(userId, bookId);
	return withStore(STORES.progressBaseline, 'readonly', (store, toPromise) =>
		toPromise(store.get(key))
	);
}

export async function setUserBaseline(userId, baseline) {
	const key = 'me:' + String(userId);
	await withStore(STORES.userBaseline, 'readwrite', (store, toPromise) =>
		toPromise(store.put({ ...baseline, userId: String(userId) }, key))
	);
}

export async function getUserBaseline(userId) {
	const key = 'me:' + String(userId);
	return withStore(STORES.userBaseline, 'readonly', (store, toPromise) =>
		toPromise(store.get(key))
	);
}

/** Build a book-shaped object for the Reader from saved meta. */
export function bookFromSavedMeta(meta, goalProgress) {
	if (!meta) return null;
	return {
		id: meta.bookId,
		title: meta.title,
		author: meta.author,
		format: meta.format,
		page_count: meta.page_count,
		current_page: meta.current_page,
		bookmark_page: meta.bookmark_page,
		status: meta.status,
		goal_daily_minutes: meta.goal_daily_minutes,
		goal_weekly_minutes: meta.goal_weekly_minutes,
		goal_monthly_minutes: meta.goal_monthly_minutes,
		has_cover: meta.has_cover,
		total_reading_seconds: meta.total_reading_seconds,
		progress_percent: meta.progress_percent,
		goal_progress: goalProgress || null,
		_offline: true
	};
}
