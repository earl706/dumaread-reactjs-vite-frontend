import { useEffect, useRef } from 'react';
import { BellOff, VolumeX } from 'lucide-react';

import { isDesktopApp } from '../../lib/desktop';
import { startTimerAlarm } from '../../lib/timerAlarm';
import { TIMER_CLOSE_EVENT } from '../../stores/createTimerStore';
import { Button } from '../ui';

/**
 * Global tick + freeze + alarm banner for a createTimerStore() instance.
 * Mount once (in App) so the clock survives navigation, including the reader.
 *
 * @param {object} props
 * @param {ReturnType<typeof import('../../stores/createTimerStore').createTimerStore>} props.timer
 * @param {(payload: object) => void} [props.onComplete]
 * @param {object} [props.labels]
 * @param {string} [props.closeEvent]  Custom event name (default `app-close`)
 */
export function TimerEngine({ timer, onComplete, labels: labelOverrides, closeEvent }) {
	const { useStore, freezeClock, config } = timer;
	const labels = { ...config.labels, ...labelOverrides };
	const eventName = closeEvent || TIMER_CLOSE_EVENT;

	const syncTick = useStore((s) => s.syncTick);
	const startAlarm = useStore((s) => s.startAlarm);
	const resolveAfterAlarm = useStore((s) => s.resolveAfterAlarm);
	const stopAlarmSound = useStore((s) => s.stopAlarmSound);
	const alarmActive = useStore((s) => s.alarmActive);
	const finishingRef = useRef(false);
	const onCompleteRef = useRef(onComplete);
	onCompleteRef.current = onComplete;

	const finishInterval = () => {
		if (finishingRef.current) return;
		finishingRef.current = true;
		try {
			const state = useStore.getState();
			const payload = state.getSessionPayload();
			onCompleteRef.current?.(payload);
			startAlarm();
			startTimerAlarm(state.alarmSound);
		} finally {
			finishingRef.current = false;
		}
	};

	const finishRef = useRef(finishInterval);
	finishRef.current = finishInterval;

	useEffect(() => {
		const state = useStore.getState();
		if (state.running && state.endAt != null && state.endAt <= Date.now()) {
			finishRef.current();
		} else if (state.running) {
			syncTick();
		}
	}, [syncTick, useStore]);

	useEffect(() => {
		const id = window.setInterval(() => {
			if (syncTick()) finishRef.current();
		}, 250);
		return () => window.clearInterval(id);
	}, [syncTick]);

	useEffect(() => {
		const freeze = () => freezeClock();
		const onVisibility = () => {
			if (document.visibilityState === 'hidden' && isDesktopApp()) freeze();
		};
		window.addEventListener('pagehide', freeze);
		window.addEventListener('beforeunload', freeze);
		window.addEventListener(eventName, freeze);
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			window.removeEventListener('pagehide', freeze);
			window.removeEventListener('beforeunload', freeze);
			window.removeEventListener(eventName, freeze);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	}, [freezeClock, eventName]);

	if (!alarmActive) return null;

	return (
		<div className="fixed bottom-6 left-1/2 z-50 w-[min(100%,24rem)] -translate-x-1/2 px-4 sm:px-0">
			<div className="border-line bg-surface flex flex-col gap-3 rounded-lg border px-4 py-3 shadow-xl sm:flex-row sm:items-center">
				<div className="min-w-0 flex-1">
					<p className="text-fg text-sm font-medium">{labels.finishedTitle}</p>
					<p className="text-muted mt-0.5 text-xs">{labels.finishedHint}</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Button size="sm" variant="ghost" onClick={stopAlarmSound}>
						<VolumeX size={15} />
						{labels.stopSound}
					</Button>
					<Button size="sm" onClick={resolveAfterAlarm}>
						<BellOff size={15} />
						{labels.stopAlarm}
					</Button>
				</div>
			</div>
		</div>
	);
}
