import { get } from '../api';
import { toast } from '../../stores/toastStore';
import { useAuthStore } from '../../stores/authStore';
import { useOfflineStore } from '../../stores/offlineStore';
import { isOnline } from './connectivity';
import {
	getUserBaseline,
	isBookSaved,
	removeBookOffline,
	saveBookOffline,
	setUserBaseline
} from './savedBooks';

async function loadStatsBaseline(userId) {
	const user = useAuthStore.getState().user;
	try {
		const stats = await get('/books/stats/');
		const baseline = {
			userId: String(userId),
			goal_daily_minutes: user?.goal_daily_minutes ?? null,
			goal_weekly_minutes: user?.goal_weekly_minutes ?? null,
			goal_monthly_minutes: user?.goal_monthly_minutes ?? null,
			goal_progress: stats?.goal_progress || null,
			updatedAt: Date.now()
		};
		await setUserBaseline(userId, baseline);
		return baseline;
	} catch {
		return (
			(await getUserBaseline(userId)) || {
				userId: String(userId),
				goal_daily_minutes: user?.goal_daily_minutes ?? null,
				goal_weekly_minutes: user?.goal_weekly_minutes ?? null,
				goal_monthly_minutes: user?.goal_monthly_minutes ?? null,
				goal_progress: null,
				updatedAt: Date.now()
			}
		);
	}
}

/** Save a library/detail book for offline reading. */
export async function saveBookForOffline(book) {
	const user = useAuthStore.getState().user;
	if (!user?.id) {
		toast.error('Sign in to save books offline.');
		return false;
	}
	if (!isOnline()) {
		toast.error('Go online to save a book for offline reading.');
		return false;
	}
	try {
		const userBaseline = await loadStatsBaseline(user.id);
		const { evicted } = await saveBookOffline(user.id, book, {
			userBaseline,
			statsGoalProgress: userBaseline.goal_progress
		});
		useOfflineStore.getState().markSaved(book.id);
		if (evicted > 0) {
			toast.info(
				`Saved “${book.title || 'book'}” offline. Removed ${evicted} older saved ${
					evicted === 1 ? 'book' : 'books'
				} to free space.`
			);
			await useOfflineStore.getState().hydrateSaved();
		} else {
			toast.success(`“${book.title || 'Book'}” saved for offline reading.`);
		}
		return true;
	} catch (err) {
		console.error(err);
		toast.error('Could not save this book offline. Storage may be full.');
		return false;
	}
}

export async function removeBookForOffline(bookId, title) {
	const user = useAuthStore.getState().user;
	if (!user?.id) return false;
	try {
		await removeBookOffline(user.id, bookId);
		useOfflineStore.getState().markUnsaved(bookId);
		toast.success(`“${title || 'Book'}” removed from offline storage.`);
		return true;
	} catch (err) {
		if (err?.code === 'pending_outbox') {
			toast.error('Sync pending reading time before removing this offline book.');
			return false;
		}
		toast.error('Could not remove offline book.');
		return false;
	}
}

export async function checkBookSaved(bookId) {
	const user = useAuthStore.getState().user;
	if (!user?.id) return false;
	return isBookSaved(user.id, bookId);
}
