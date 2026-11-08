const DB_NAME = 'dumaread-offline';
const DB_VERSION = 1;

export const STORES = {
	savedBooks: 'savedBooks',
	bookContent: 'bookContent',
	bookCovers: 'bookCovers',
	progressBaseline: 'progressBaseline',
	userBaseline: 'userBaseline',
	outbox: 'outbox',
	meta: 'meta'
};

/** @type {Promise<IDBDatabase>|null} */
let dbPromise = null;

function openDb() {
	if (typeof indexedDB === 'undefined') {
		return Promise.reject(new Error('IndexedDB unavailable'));
	}
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORES.savedBooks)) {
				const store = db.createObjectStore(STORES.savedBooks, { keyPath: 'bookId' });
				store.createIndex('byUser', 'userId', { unique: false });
				store.createIndex('byAccessed', 'lastAccessedAt', { unique: false });
			}
			if (!db.objectStoreNames.contains(STORES.bookContent)) {
				db.createObjectStore(STORES.bookContent);
			}
			if (!db.objectStoreNames.contains(STORES.bookCovers)) {
				db.createObjectStore(STORES.bookCovers);
			}
			if (!db.objectStoreNames.contains(STORES.progressBaseline)) {
				db.createObjectStore(STORES.progressBaseline);
			}
			if (!db.objectStoreNames.contains(STORES.userBaseline)) {
				db.createObjectStore(STORES.userBaseline);
			}
			if (!db.objectStoreNames.contains(STORES.outbox)) {
				const outbox = db.createObjectStore(STORES.outbox, {
					keyPath: 'id',
					autoIncrement: true
				});
				outbox.createIndex('byStatus', 'status', { unique: false });
				outbox.createIndex('byBook', 'bookId', { unique: false });
				outbox.createIndex('byUser', 'userId', { unique: false });
			}
			if (!db.objectStoreNames.contains(STORES.meta)) {
				db.createObjectStore(STORES.meta);
			}
		};
		req.onsuccess = () => resolve(req.result);
	});
	return dbPromise;
}

function reqToPromise(request) {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export async function withStore(storeName, mode, fn) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, mode);
		const store = tx.objectStore(storeName);
		let result;
		tx.oncomplete = () => resolve(result);
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
		Promise.resolve(fn(store, reqToPromise))
			.then((value) => {
				result = value;
			})
			.catch((err) => {
				try {
					tx.abort();
				} catch {
					/* ignore */
				}
				reject(err);
			});
	});
}

export async function withStores(storeNames, mode, fn) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeNames, mode);
		const stores = Object.fromEntries(storeNames.map((name) => [name, tx.objectStore(name)]));
		let result;
		tx.oncomplete = () => resolve(result);
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
		Promise.resolve(fn(stores, reqToPromise))
			.then((value) => {
				result = value;
			})
			.catch((err) => {
				try {
					tx.abort();
				} catch {
					/* ignore */
				}
				reject(err);
			});
	});
}

export function isQuotaExceeded(err) {
	if (!err) return false;
	if (err.name === 'QuotaExceededError') return true;
	if (err.code === 22) return true;
	return /quota/i.test(String(err.message || ''));
}

/** Wipe all offline data (e.g. account switch). */
export async function clearOfflineDb() {
	const db = await openDb();
	const names = Array.from(db.objectStoreNames);
	await new Promise((resolve, reject) => {
		const tx = db.transaction(names, 'readwrite');
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		for (const name of names) tx.objectStore(name).clear();
	});
}

export async function getMeta(key) {
	return withStore(STORES.meta, 'readonly', (store, toPromise) => toPromise(store.get(key)));
}

export async function setMeta(key, value) {
	return withStore(STORES.meta, 'readwrite', (store, toPromise) =>
		toPromise(store.put(value, key))
	);
}
