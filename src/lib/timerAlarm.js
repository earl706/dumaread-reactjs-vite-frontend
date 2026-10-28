let audioCtx = null;
let alarmInterval = null;
let alarmTimeout = null;

export const TIMER_ALARM_MAX_MS = 30000;
export const DEFAULT_TIMER_ALARM_SOUND = 'chime';

export const TIMER_ALARM_SOUNDS = [
	{ id: 'chime', label: 'Chime', description: 'Classic four-note chime' },
	{ id: 'bell', label: 'Bell', description: 'Warm bell tones' },
	{ id: 'digital', label: 'Digital', description: 'Sharp electronic beeps' },
	{ id: 'soft', label: 'Soft', description: 'Gentle rising notes' },
	{ id: 'urgent', label: 'Urgent', description: 'Fast repeating alert' }
];

const ALARM_REPEAT_MS = {
	chime: 2200,
	bell: 2400,
	digital: 1800,
	soft: 2800,
	urgent: 1600
};

/** Peak gain multiplier applied to every tone (Web Audio linear gain). */
const MASTER_VOLUME = 2.8;

function getAudioContext() {
	if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	return audioCtx;
}

function tone(ctx, when, freq, { duration = 0.35, type = 'sine', volume = 0.55 } = {}) {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	const peak = Math.max(0.0001, volume * MASTER_VOLUME);
	osc.type = type;
	osc.frequency.value = freq;
	gain.gain.setValueAtTime(0.0001, when);
	gain.gain.exponentialRampToValueAtTime(peak, when + 0.02);
	gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
	osc.connect(gain);
	gain.connect(ctx.destination);
	osc.start(when);
	osc.stop(when + duration);
}

const ALARM_PATTERNS = {
	chime: (ctx, t) => {
		[880, 880, 1100, 880].forEach((freq, i) => tone(ctx, t + i * 0.45, freq, { volume: 0.65 }));
	},
	bell: (ctx, t) => {
		[523, 659, 784].forEach((freq, i) =>
			tone(ctx, t + i * 0.55, freq, { type: 'triangle', duration: 0.6, volume: 0.5 })
		);
	},
	digital: (ctx, t) => {
		[1200, 1200, 1200].forEach((freq, i) =>
			tone(ctx, t + i * 0.2, freq, { type: 'square', duration: 0.12, volume: 0.45 })
		);
	},
	soft: (ctx, t) => {
		[440, 554, 659, 880].forEach((freq, i) =>
			tone(ctx, t + i * 0.5, freq, { duration: 0.5, volume: 0.48 })
		);
	},
	urgent: (ctx, t) => {
		[1400, 1000, 1400, 1000].forEach((freq, i) =>
			tone(ctx, t + i * 0.15, freq, { duration: 0.12, volume: 0.52 })
		);
	}
};

function resolveSoundId(soundId) {
	return ALARM_PATTERNS[soundId] ? soundId : DEFAULT_TIMER_ALARM_SOUND;
}

export function playTimerAlarmSound(soundId = DEFAULT_TIMER_ALARM_SOUND) {
	try {
		const ctx = getAudioContext();
		if (ctx.state === 'suspended') ctx.resume();
		const play = ALARM_PATTERNS[resolveSoundId(soundId)];
		play(ctx, ctx.currentTime);
	} catch {
		/* audio blocked or unavailable */
	}
}

export function previewTimerAlarmSound(soundId) {
	playTimerAlarmSound(soundId);
}

export function startTimerAlarm(soundId = DEFAULT_TIMER_ALARM_SOUND) {
	stopTimerAlarm();
	const id = resolveSoundId(soundId);
	const repeatMs = ALARM_REPEAT_MS[id] ?? ALARM_REPEAT_MS.chime;

	playTimerAlarmSound(id);
	alarmInterval = window.setInterval(() => playTimerAlarmSound(id), repeatMs);
	alarmTimeout = window.setTimeout(stopTimerAlarm, TIMER_ALARM_MAX_MS);
}

export function stopTimerAlarm() {
	if (alarmInterval != null) window.clearInterval(alarmInterval);
	if (alarmTimeout != null) window.clearTimeout(alarmTimeout);
	alarmInterval = null;
	alarmTimeout = null;
}
