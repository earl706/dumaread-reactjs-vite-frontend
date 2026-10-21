import { Modal } from './Modal';
import { Button } from './Button';

/**
 * Read-only key/value detail modal for a Table / DataSheet row.
 * fields: [{ label, value }] — value may be a React node.
 */
export function RecordInfoModal({ open, onClose, title = 'Details', fields = [] }) {
	return (
		<Modal
			open={open}
			onClose={onClose}
			title={title}
			size="md"
			footer={
				<Button variant="secondary" onClick={onClose}>
					Close
				</Button>
			}
		>
			<dl className="divide-line divide-y text-sm">
				{fields.map(({ label, value }) => (
					<div key={label} className="flex gap-4 py-2.5 first:pt-0 last:pb-0">
						<dt className="text-muted w-36 shrink-0">{label}</dt>
						<dd className="text-fg min-w-0 flex-1 break-words">{value ?? '—'}</dd>
					</div>
				))}
			</dl>
		</Modal>
	);
}
