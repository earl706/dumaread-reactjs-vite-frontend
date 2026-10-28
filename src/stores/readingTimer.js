import { createTimerStore } from './createTimerStore';

/**
 * Global Topbar countdown. Independent of reader heartbeats; not bound to a book.
 * Duration and remaining persist in localStorage under persistKey.
 */
export const readingTimer = createTimerStore({
	persistKey: 'dumaread.reading-timer',
	defaultSeconds: 25 * 60,
	presetsMinutes: [15, 25, 45, 60],
	labels: {
		title: 'Reading timer',
		idleAria: 'Reading timer',
		remainingAria: (display) => `Reading timer ${display} remaining`,
		finishedTitle: 'Reading session finished'
	}
});
