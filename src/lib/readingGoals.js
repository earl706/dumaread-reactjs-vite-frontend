/** Period keys used for reading goals (minutes). */
export const GOAL_PERIODS = [
	{ key: 'daily', field: 'goal_daily_minutes', label: 'Daily', hint: 'Minutes per calendar day' },
	{
		key: 'weekly',
		field: 'goal_weekly_minutes',
		label: 'Weekly',
		hint: 'Minutes per Mon–Sun week'
	},
	{
		key: 'monthly',
		field: 'goal_monthly_minutes',
		label: 'Monthly',
		hint: 'Minutes per calendar month'
	}
];

/**
 * Daily-relative multipliers for calibrating the other periods.
 * weekly = daily × weekly; monthly = daily × monthly.
 */
export const DEFAULT_GOAL_CALIBRATE_MULTIPLIERS = {
	weekly: 7,
	monthly: 30
};

const FIELD_BY_KEY = Object.fromEntries(GOAL_PERIODS.map((p) => [p.key, p.field]));

/**
 * Derive all three goal fields from one source period (always overwrites).
 * Empty/invalid source clears every period.
 * Non-integers round to nearest; results below 1 become blank.
 *
 * @param {Record<string, string>} form
 * @param {'daily'|'weekly'|'monthly'} sourceKey
 * @param {{ weekly?: number, monthly?: number }} [multipliers]
 * @returns {Record<string, string>}
 */
export function calibrateGoalForm(
	form,
	sourceKey,
	multipliers = DEFAULT_GOAL_CALIBRATE_MULTIPLIERS
) {
	const weeklyMult = Number(multipliers?.weekly) || DEFAULT_GOAL_CALIBRATE_MULTIPLIERS.weekly;
	const monthlyMult = Number(multipliers?.monthly) || DEFAULT_GOAL_CALIBRATE_MULTIPLIERS.monthly;
	const sourceField = FIELD_BY_KEY[sourceKey];
	if (!sourceField) return { ...form };

	const sourceMinutes = parseMinutes(form[sourceField]);
	if (sourceMinutes == null) {
		// Blank/invalid source clears every period (including the source).
		return emptyGoalForm();
	}

	let daily;
	if (sourceKey === 'daily') daily = sourceMinutes;
	else if (sourceKey === 'weekly') daily = sourceMinutes / weeklyMult;
	else daily = sourceMinutes / monthlyMult;

	return {
		goal_daily_minutes: minutesToFormString(daily),
		goal_weekly_minutes: minutesToFormString(daily * weeklyMult),
		goal_monthly_minutes: minutesToFormString(daily * monthlyMult)
	};
}

function minutesToFormString(value) {
	if (!Number.isFinite(value)) return '';
	const n = Math.round(value);
	return n < 1 ? '' : String(n);
}

/** Blank form values for goal minute inputs. */
export function emptyGoalForm() {
	return {
		goal_daily_minutes: '',
		goal_weekly_minutes: '',
		goal_monthly_minutes: ''
	};
}

/** Prefill form strings from a user or book record. */
export function goalFormFromRecord(record) {
	return {
		goal_daily_minutes: minutesToInput(record?.goal_daily_minutes),
		goal_weekly_minutes: minutesToInput(record?.goal_weekly_minutes),
		goal_monthly_minutes: minutesToInput(record?.goal_monthly_minutes)
	};
}

function minutesToInput(value) {
	return value == null || value === '' ? '' : String(value);
}

/** Parse form strings into API payload (null clears a goal). */
export function parseGoalForm(form) {
	return {
		goal_daily_minutes: parseMinutes(form.goal_daily_minutes),
		goal_weekly_minutes: parseMinutes(form.goal_weekly_minutes),
		goal_monthly_minutes: parseMinutes(form.goal_monthly_minutes)
	};
}

function parseMinutes(raw) {
	const trimmed = String(raw ?? '').trim();
	if (!trimmed) return null;
	const n = Number(trimmed);
	if (!Number.isFinite(n) || n < 1) return null;
	return Math.floor(n);
}

/**
 * Book periods that exceed matching user-wide goals.
 * @returns {{ key: string, label: string, book: number, user: number }[]}
 */
export function exceedingGoalPeriods(bookGoals, user) {
	const exceeded = [];
	for (const { key, field, label } of GOAL_PERIODS) {
		const book = bookGoals[field];
		const userGoal = user?.[field];
		if (book != null && userGoal != null && book > userGoal) {
			exceeded.push({ key, label, book, user: userGoal });
		}
	}
	return exceeded;
}

const GOAL_MET_STORAGE_KEY = 'dumaread.goalMetNotified';

/** Whether a goal_progress entry is at or over its target. */
export function isGoalPeriodMet(entry) {
	if (entry == null || entry.goal_minutes == null) return false;
	const goal = Number(entry.goal_minutes);
	if (!Number.isFinite(goal) || goal < 0) return false;
	if (entry.percent != null) return Number(entry.percent) >= 100;
	const secs = Number(entry.seconds);
	if (Number.isFinite(secs)) return secs >= goal * 60;
	const mins = Number(entry.minutes);
	return Number.isFinite(mins) && mins >= goal;
}

function readGoalMetMap() {
	try {
		const raw = localStorage.getItem(GOAL_MET_STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

function writeGoalMetMap(map) {
	try {
		localStorage.setItem(GOAL_MET_STORAGE_KEY, JSON.stringify(map));
	} catch {
		/* ignore quota / private mode */
	}
}

function notifiedKey(scope, id, periodKey) {
	return `${scope}:${id}:${periodKey}`;
}

/**
 * Collect periods that just crossed from unmet → met, skipping ones already
 * notified for the same goal_minutes target (until that goal changes/clears).
 */
export function collectNewlyMetGoalPeriods({
	prevProgress,
	nextProgress,
	scope,
	scopeId,
	notified = readGoalMetMap()
}) {
	const newlyMet = [];
	for (const { key, label } of GOAL_PERIODS) {
		const prev = prevProgress?.[key];
		const next = nextProgress?.[key];
		if (!isGoalPeriodMet(next) || isGoalPeriodMet(prev)) continue;
		const goalMinutes = next.goal_minutes;
		const storageKey = notifiedKey(scope, scopeId, key);
		if (notified[storageKey] === goalMinutes) continue;
		newlyMet.push({
			scope,
			scopeId,
			key,
			label,
			goalMinutes,
			storageKey,
			display: `${scope === 'book' ? 'Book' : 'User'} ${label}`
		});
	}
	return newlyMet;
}

export function markGoalPeriodsNotified(entries) {
	if (!entries?.length) return;
	const map = readGoalMetMap();
	for (const entry of entries) {
		map[entry.storageKey] = entry.goalMinutes;
	}
	writeGoalMetMap(map);
}

export function formatGoalsMetToastMessage(entries) {
	if (!entries?.length) return '';
	const labels = entries.map((e) => e.display);
	if (labels.length === 1) return `${labels[0]} goal met`;
	if (labels.length === 2) return `${labels[0]} and ${labels[1]} goals met`;
	return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]} goals met`;
}

/**
 * Session watcher: seed on first heartbeat (no toast), then toast on crossings.
 * First toast in the session is success; later toasts are info.
 *
 * @param {{ toast: { success: Function, info: Function } }} deps
 */
export function createGoalMetWatcher({ toast }) {
	let prevBook = null;
	let prevUser = null;
	let seeded = false;
	let toastedThisSession = false;

	return {
		/** @param {{ id?: string|number, goal_progress?: object, user_goal_progress?: object }} data */
		handle(data) {
			if (!data) return;
			const bookId = data.id;
			const bookProgress = data.goal_progress;
			const userProgress = data.user_goal_progress;

			if (!seeded) {
				prevBook = bookProgress ?? null;
				prevUser = userProgress ?? null;
				seeded = true;
				return;
			}

			const notified = readGoalMetMap();
			const newlyMet = [
				...collectNewlyMetGoalPeriods({
					prevProgress: prevBook,
					nextProgress: bookProgress,
					scope: 'book',
					scopeId: bookId,
					notified
				}),
				...collectNewlyMetGoalPeriods({
					prevProgress: prevUser,
					nextProgress: userProgress,
					scope: 'user',
					scopeId: 'me',
					notified
				})
			];

			prevBook = bookProgress ?? null;
			prevUser = userProgress ?? null;

			if (!newlyMet.length) return;
			markGoalPeriodsNotified(newlyMet);
			const message = formatGoalsMetToastMessage(newlyMet);
			if (!toastedThisSession) {
				toast.success(message);
				toastedThisSession = true;
			} else {
				toast.info(message);
			}
		}
	};
}
