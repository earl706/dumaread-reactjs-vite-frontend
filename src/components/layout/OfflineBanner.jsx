import { useOfflineStore } from '../../stores/offlineStore';

function formatPendingMinutes(seconds) {
	const mins = Math.max(1, Math.round((Number(seconds) || 0) / 60));
	return mins;
}

/** Connectivity / sync status strip for AppLayout and Reader. */
export function OfflineBanner({ className = '' }) {
	const online = useOfflineStore((s) => s.online);
	const pendingSeconds = useOfflineStore((s) => s.pendingSeconds);
	const syncing = useOfflineStore((s) => s.syncing);

	if (online && !syncing && pendingSeconds <= 0) return null;

	let message = '';
	if (!online && pendingSeconds > 0) {
		message = `Offline — ${formatPendingMinutes(pendingSeconds)} min pending sync`;
	} else if (!online) {
		message = 'Offline — reading time will sync when you’re back online';
	} else if (syncing || pendingSeconds > 0) {
		message = `Syncing ${formatPendingMinutes(pendingSeconds)} min…`;
	}

	if (!message) return null;

	return (
		<div
			role="status"
			className={
				'border-line bg-surface-2 text-muted border-b px-4 py-1.5 text-center text-xs ' + className
			}
		>
			{message}
		</div>
	);
}
