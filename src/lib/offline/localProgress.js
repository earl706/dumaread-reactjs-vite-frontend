import { GOAL_PERIODS } from '../readingGoals';
import { pendingSecondsByBook, sumPendingSeconds } from './outbox';
import { getProgressBaseline, getUserBaseline } from './savedBooks';

function cloneEntry(entry) {
	if (!entry || typeof entry !== 'object') {
		return { goal_minutes: null, minutes: 0, seconds: 0, percent: null };
	}
	return {
		goal_minutes: entry.goal_minutes ?? null,
		minutes: Number(entry.minutes) || 0,
		seconds: Number(entry.seconds) || 0,
		percent: entry.percent ?? null
	};
}

function withExtraSeconds(entry, extraSeconds) {
	const next = cloneEntry(entry);
	const secs = Math.max(0, (Number(next.seconds) || 0) + Math.max(0, extraSeconds || 0));
	next.seconds = secs;
	next.minutes = secs ? Math.round((secs / 60) * 10) / 10 : 0;
	if (next.goal_minutes == null) {
		next.percent = null;
		return next;
	}
	const goal = Math.max(0, Number(next.goal_minutes) || 0);
	if (goal <= 0) {
		next.percent = 100;
		return next;
	}
	next.percent = Math.round(Math.min(100, (100 * secs) / (goal * 60)) * 10) / 10;
	return next;
}

/**
 * Apply the same extra seconds to every period (offline reading accrues to day/week/month).
 */
export function applyPendingToProgress(progress, extraSeconds) {
	const base = progress || {};
	const out = {};
	for (const { key } of GOAL_PERIODS) {
		out[key] = withExtraSeconds(base[key], extraSeconds);
	}
	return out;
}

export async function getMergedBookProgress(userId, bookId) {
	const baseline = await getProgressBaseline(userId, bookId);
	const pending = await sumPendingSeconds(userId, bookId);
	return applyPendingToProgress(baseline?.goal_progress, pending);
}

export async function getMergedUserProgress(userId) {
	const baseline = await getUserBaseline(userId);
	const pending = await sumPendingSeconds(userId);
	return {
		goal_progress: applyPendingToProgress(baseline?.goal_progress, pending),
		goal_daily_minutes: baseline?.goal_daily_minutes ?? null,
		goal_weekly_minutes: baseline?.goal_weekly_minutes ?? null,
		goal_monthly_minutes: baseline?.goal_monthly_minutes ?? null,
		pendingSeconds: pending
	};
}

/** Synthetic heartbeat-shaped payload for offline goal-met watcher. */
export async function buildSyntheticHeartbeatPayload(userId, bookId, bookMeta) {
	const bookProgress = await getMergedBookProgress(userId, bookId);
	const user = await getMergedUserProgress(userId);
	return {
		id: Number(bookId),
		goal_daily_minutes: bookMeta?.goal_daily_minutes ?? null,
		goal_weekly_minutes: bookMeta?.goal_weekly_minutes ?? null,
		goal_monthly_minutes: bookMeta?.goal_monthly_minutes ?? null,
		goal_progress: bookProgress,
		user_goal_progress: user.goal_progress
	};
}

export async function getPendingByBookMap(userId) {
	return pendingSecondsByBook(userId);
}
