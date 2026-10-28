import { useState } from 'react';
import { Bell, Music2, Pause, Play, Radio, RotateCcw, Timer, Volume1, Zap } from 'lucide-react';

import { cn } from '../../lib/format';
import { previewTimerAlarmSound, TIMER_ALARM_SOUNDS } from '../../lib/timerAlarm';
import { formatTimerDisplay } from '../../lib/timerFormat';
import { selectIntervalActive } from '../../stores/createTimerStore';
import { Button, Modal, ProgressRing } from '../ui';

const ALARM_ICONS = {
	chime: Music2,
	bell: Bell,
	digital: Radio,
	soft: Volume1,
	urgent: Zap
};

function resolveLabels(timer, labels) {
	return { ...timer.config.labels, ...labels };
}

function IconChoice({ selected, disabled, icon: Icon, label, onClick, ariaLabel }) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			aria-label={ariaLabel || label}
			aria-pressed={selected}
			title={label}
			className={cn(
				'inline-flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-1 transition-colors duration-150',
				'focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2',
				'disabled:pointer-events-none disabled:opacity-50',
				selected ? 'text-primary' : 'text-muted hover:text-fg'
			)}
		>
			<Icon size={16} aria-hidden />
			<span className="max-w-full truncate text-[10px] font-medium tracking-wide">{label}</span>
		</button>
	);
}

/**
 * Topbar icon + modal for a createTimerStore() instance.
 *
 * @param {object} props
 * @param {ReturnType<typeof import('../../stores/createTimerStore').createTimerStore>} props.timer
 * @param {object} [props.labels]  Overlay on the store's configured labels
 */
export function TimerButton({ timer, labels: labelOverrides }) {
	const { useStore, config } = timer;
	const labels = resolveLabels(timer, labelOverrides);
	const [open, setOpen] = useState(false);

	const running = useStore((s) => s.running);
	const remainingSeconds = useStore((s) => s.remainingSeconds);
	const totalSeconds = useStore((s) => s.totalSeconds);
	const sessionActive = useStore(selectIntervalActive);
	const start = useStore((s) => s.start);
	const pause = useStore((s) => s.pause);
	const reset = useStore((s) => s.reset);
	const setDurationSeconds = useStore((s) => s.setDurationSeconds);
	const addDuration = useStore((s) => s.addDuration);
	const alarmActive = useStore((s) => s.alarmActive);
	const alarmSound = useStore((s) => s.alarmSound);
	const setAlarmSound = useStore((s) => s.setAlarmSound);

	const locked = sessionActive || alarmActive;
	const remainingPct = totalSeconds > 0 ? (remainingSeconds / totalSeconds) * 100 : 0;
	const display = formatTimerDisplay(remainingSeconds);
	const canStart = remainingSeconds > 0;
	const canEditDuration = !locked;
	const dialMinutes = Math.max(1, Math.round(config.dialAdjustSeconds / 60));

	const remainingAria =
		typeof labels.remainingAria === 'function'
			? labels.remainingAria(display)
			: labels.remainingAria;
	const ariaLabel = sessionActive ? remainingAria : labels.idleAria;

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="hover:bg-surface-2 relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md"
				aria-label={ariaLabel}
				title={ariaLabel}
			>
				{sessionActive || running ? (
					<ProgressRing value={remainingPct} size={28} stroke={3} tone="primary" label="" />
				) : (
					<Timer size={18} className="text-muted" />
				)}
			</button>

			<Modal open={open} onClose={() => setOpen(false)} title={labels.title} size="sm">
				<div className="space-y-4">
					<div className="flex flex-col items-center gap-2">
						<div className="flex w-full items-center justify-center gap-3">
							{canEditDuration && (
								<Button
									size="sm"
									variant="secondary"
									onClick={() => addDuration(-config.dialAdjustSeconds)}
									aria-label={labels.decrease}
								>
									-{dialMinutes}m
								</Button>
							)}
							<div className="relative inline-flex items-center justify-center">
								<ProgressRing
									value={sessionActive ? remainingPct : 0}
									size={148}
									stroke={8}
									tone="primary"
									label=""
								/>
								<p className="text-fg pointer-events-none absolute font-mono text-3xl font-bold tracking-tight tabular-nums">
									{display}
								</p>
							</div>
							{canEditDuration && (
								<Button
									size="sm"
									variant="secondary"
									onClick={() => addDuration(config.dialAdjustSeconds)}
									aria-label={labels.increase}
								>
									+{dialMinutes}m
								</Button>
							)}
						</div>
					</div>

					<div className="flex items-center justify-center">
						{sessionActive ? (
							<div className="bg-surface-2 flex items-center gap-1 rounded-md p-1">
								{running ? (
									<Button size="sm" variant="secondary" onClick={pause} aria-label={labels.pause}>
										<Pause size={16} />
										{labels.pause}
									</Button>
								) : (
									<Button size="sm" onClick={start} aria-label={labels.resume}>
										<Play size={16} />
										{labels.resume}
									</Button>
								)}
								<Button size="sm" variant="ghost" onClick={reset} aria-label={labels.reset}>
									<RotateCcw size={16} />
									{labels.reset}
								</Button>
							</div>
						) : (
							<Button onClick={start} disabled={!canStart} aria-label={labels.start}>
								<Play size={18} />
								{labels.start}
							</Button>
						)}
					</div>

					{canEditDuration && config.presetsMinutes.length > 0 && (
						<div className="flex flex-wrap justify-center gap-2">
							{config.presetsMinutes.map((minutes) => (
								<Button
									key={minutes}
									size="sm"
									variant="secondary"
									onClick={() => setDurationSeconds(minutes * 60)}
								>
									{minutes}m
								</Button>
							))}
						</div>
					)}

					<div className="space-y-1.5">
						<p className="text-fg text-sm font-medium">{labels.alarmGroup}</p>
						<div className="flex gap-1.5" role="group" aria-label={labels.alarmGroup}>
							{TIMER_ALARM_SOUNDS.map((s) => {
								const Icon = ALARM_ICONS[s.id] || Bell;
								const alarmAria =
									typeof labels.alarmAria === 'function' ? labels.alarmAria(s.label) : s.label;
								return (
									<IconChoice
										key={s.id}
										icon={Icon}
										label={s.label}
										ariaLabel={alarmAria}
										selected={alarmSound === s.id}
										disabled={locked}
										onClick={() => {
											setAlarmSound(s.id);
											previewTimerAlarmSound(s.id);
										}}
									/>
								);
							})}
						</div>
					</div>
				</div>
			</Modal>
		</>
	);
}
