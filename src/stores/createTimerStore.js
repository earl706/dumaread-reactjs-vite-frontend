import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_TIMER_ALARM_SOUND, stopTimerAlarm } from '../lib/timerAlarm';
import { hmsFromSeconds, secondsFromHms } from '../lib/timerFormat';

/** Custom window event desktop shells should dispatch before hiding/quitting. */
export const TIMER_CLOSE_EVENT = 'app-close';

export const DEFAULT_TIMER_PRESETS_MINUTES = [15, 25, 45, 60];
export const DEFAULT_DIAL_ADJUST_SECONDS = 5 * 60;
export const DEFAULT_TIMER_SECONDS = 25 * 60;

export const DEFAULT_TIMER_LABELS = {
	title: 'Timer',
	idleAria: 'Timer',
	remainingAria: (display) => `Timer ${display} remaining`,
	start: 'Start',
	pause: 'Pause',
	resume: 'Resume',
	reset: 'Reset',
	decrease: 'Decrease timer by 5 minutes',
	increase: 'Increase timer by 5 minutes',
	finishedTitle: 'Timer finished',
	finishedHint: 'Stop the alarm when you are ready.',
	stopSound: 'Stop sound',
	stopAlarm: 'Stop alarm',
	alarmGroup: 'Alarm',
	alarmAria: (label) => `${label} alarm`
};

export function selectIntervalActive(s) {
	if (s.remainingSeconds <= 0) return false;
	return Boolean(s.startedAt);
}

function applyDuration(set, total) {
	const normalized = Math.max(0, Math.floor(Number(total) || 0));
	const hms = hmsFromSeconds(normalized);
	set({
		totalSeconds: normalized,
		remainingSeconds: normalized,
		inputHours: hms.hours,
		inputMinutes: hms.minutes,
		inputSeconds: hms.seconds
	});
}

function remainingFromEndAt(s) {
	return s.endAt ? Math.max(0, Math.ceil((s.endAt - Date.now()) / 1000)) : s.remainingSeconds;
}

/**
 * Factory for an independent free-countdown clock.
 *
 * Each call returns its own Zustand persist store so apps can run a reading
 * timer, study timer, etc. side by side. Pass distinct persistKey values.
 *
 * @param {object} options
 * @param {string} options.persistKey  localStorage key (required, unique per timer)
 * @param {number} [options.defaultSeconds]
 * @param {number[]} [options.presetsMinutes]
 * @param {number} [options.dialAdjustSeconds]
 * @param {object} [options.labels]  Overlay on DEFAULT_TIMER_LABELS
 */
export function createTimerStore(options = {}) {
	const persistKey = options.persistKey;
	if (!persistKey || typeof persistKey !== 'string') {
		throw new Error('createTimerStore requires a persistKey string');
	}

	const defaultSeconds = Math.max(
		0,
		Math.floor(Number(options.defaultSeconds) || DEFAULT_TIMER_SECONDS)
	);
	const presetsMinutes = Array.isArray(options.presetsMinutes)
		? options.presetsMinutes.filter((n) => Number(n) > 0)
		: DEFAULT_TIMER_PRESETS_MINUTES;
	const dialAdjustSeconds =
		Number(options.dialAdjustSeconds) > 0
			? Math.floor(Number(options.dialAdjustSeconds))
			: DEFAULT_DIAL_ADJUST_SECONDS;
	const labels = { ...DEFAULT_TIMER_LABELS, ...options.labels };
	const defaultHms = hmsFromSeconds(defaultSeconds);

	const useStore = create(
		persist(
			(set, get) => ({
				totalSeconds: defaultSeconds,
				remainingSeconds: defaultSeconds,
				running: false,
				endAt: null,
				startedAt: null,
				interruptions: 0,
				inputHours: defaultHms.hours,
				inputMinutes: defaultHms.minutes,
				inputSeconds: defaultHms.seconds,
				alarmActive: false,
				alarmStartedAt: null,
				alarmSound: DEFAULT_TIMER_ALARM_SOUND,

				setAlarmSound: (alarmSound) => {
					const s = get();
					if (s.running || selectIntervalActive(s) || s.alarmActive) return;
					set({ alarmSound });
				},

				startAlarm: () =>
					set({
						alarmActive: true,
						alarmStartedAt: Date.now()
					}),

				stopAlarmSound: () => {
					stopTimerAlarm();
				},

				resolveAfterAlarm: () => {
					stopTimerAlarm();
					set({
						alarmActive: false,
						alarmStartedAt: null
					});
					get().clearAfterFinish();
				},

				setDurationSeconds: (total) => {
					const s = get();
					if (s.running || selectIntervalActive(s) || s.alarmActive) return;
					const capped = Math.min(99 * 3600 + 59 * 60 + 59, Math.max(0, Math.floor(total)));
					applyDuration(set, capped);
				},

				addDuration: (delta) => {
					const s = get();
					if (s.running || selectIntervalActive(s) || s.alarmActive) return;
					get().setDurationSeconds(s.remainingSeconds + delta);
				},

				start: () => {
					const s = get();
					if (s.running) return;
					let remaining = s.remainingSeconds;
					if (remaining <= 0) {
						const total = secondsFromHms(s.inputHours, s.inputMinutes, s.inputSeconds);
						if (total <= 0) return;
						remaining = total;
						applyDuration(set, remaining);
					}
					const now = Date.now();
					set({
						running: true,
						remainingSeconds: remaining,
						endAt: now + remaining * 1000,
						startedAt: s.startedAt || new Date(now).toISOString()
					});
				},

				pause: () => {
					const s = get();
					if (!s.running) return;
					set({
						running: false,
						endAt: null,
						remainingSeconds: remainingFromEndAt(s),
						interruptions: s.interruptions + 1
					});
				},

				freezeClock: () => {
					const s = get();
					if (!s.running) return;
					set({
						running: false,
						endAt: null,
						remainingSeconds: remainingFromEndAt(s)
					});
				},

				reset: () => {
					stopTimerAlarm();
					const s = get();
					const total =
						s.totalSeconds ||
						secondsFromHms(s.inputHours, s.inputMinutes, s.inputSeconds) ||
						defaultSeconds;
					applyDuration(set, total);
					set({
						running: false,
						endAt: null,
						startedAt: null,
						interruptions: 0,
						alarmActive: false,
						alarmStartedAt: null
					});
				},

				syncTick: () => {
					const s = get();
					if (!s.running || s.endAt == null) return false;
					const remaining = Math.max(0, Math.ceil((s.endAt - Date.now()) / 1000));
					if (remaining <= 0) {
						set({ running: false, endAt: null, remainingSeconds: 0 });
						return true;
					}
					if (remaining !== s.remainingSeconds) set({ remainingSeconds: remaining });
					return false;
				},

				getSessionPayload: () => {
					const s = get();
					const totalSeconds = Math.max(0, Math.floor(Number(s.totalSeconds) || 0));
					const remainingSeconds = Math.max(0, Math.floor(Number(s.remainingSeconds) || 0));
					const elapsed = Math.max(0, totalSeconds - remainingSeconds);
					const actualSeconds = elapsed || totalSeconds;
					return {
						persistKey,
						startedAt: s.startedAt || new Date().toISOString(),
						plannedSeconds: totalSeconds,
						actualSeconds,
						interruptions: s.interruptions
					};
				},

				clearAfterFinish: () => {
					const { inputHours, inputMinutes, inputSeconds } = get();
					const total = secondsFromHms(inputHours, inputMinutes, inputSeconds) || defaultSeconds;
					applyDuration(set, total);
					set({
						running: false,
						endAt: null,
						startedAt: null,
						interruptions: 0
					});
				}
			}),
			{
				name: persistKey,
				partialize: (s) => ({
					totalSeconds: s.totalSeconds,
					remainingSeconds: s.remainingSeconds,
					startedAt: s.startedAt,
					interruptions: s.interruptions,
					inputHours: s.inputHours,
					inputMinutes: s.inputMinutes,
					inputSeconds: s.inputSeconds,
					alarmSound: s.alarmSound
				}),
				merge: (persisted, current) => ({
					...current,
					...(persisted && typeof persisted === 'object' ? persisted : {}),
					running: false,
					endAt: null
				})
			}
		)
	);

	const freezeClock = () => useStore.getState().freezeClock();

	return {
		useStore,
		freezeClock,
		config: {
			persistKey,
			defaultSeconds,
			presetsMinutes,
			dialAdjustSeconds,
			labels
		}
	};
}
