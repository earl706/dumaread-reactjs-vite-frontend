export function formatTimerDisplay(totalSeconds) {
	const safe = Math.max(0, Math.floor(totalSeconds));
	const h = Math.floor(safe / 3600);
	const m = Math.floor((safe % 3600) / 60);
	const s = safe % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function secondsFromHms(hours, minutes, seconds) {
	return Math.max(
		0,
		(Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0)
	);
}

export function hmsFromSeconds(total) {
	const safe = Math.max(0, Math.floor(total));
	return {
		hours: Math.floor(safe / 3600),
		minutes: Math.floor((safe % 3600) / 60),
		seconds: safe % 60
	};
}
