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
