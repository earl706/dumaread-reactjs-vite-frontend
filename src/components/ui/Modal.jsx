import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

import { Button } from './Button';

/**
 * Accessible modal dialog.
 * - Closes on Escape and backdrop click.
 * - Locks body scroll while open.
 * - role="dialog" + aria-modal for screen readers.
 */
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
	useEffect(() => {
		if (!open) return;
		const onKey = (e) => e.key === 'Escape' && onClose?.();
		document.addEventListener('keydown', onKey);
		document.body.style.overflow = 'hidden';
		return () => {
			document.removeEventListener('keydown', onKey);
			document.body.style.overflow = '';
		};
	}, [open, onClose]);

	const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

	return (
		<AnimatePresence>
			{open && (
				<motion.div
					className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
				>
					<div
						className="absolute inset-0 cursor-pointer bg-black/50 backdrop-blur-sm"
						onClick={onClose}
						aria-hidden="true"
					/>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-label={title}
						className={`relative w-full ${widths[size]} border-line bg-surface rounded-t-lg border shadow-xl sm:rounded-lg`}
						initial={{ y: 24, opacity: 0, scale: 0.98 }}
						animate={{ y: 0, opacity: 1, scale: 1 }}
						exit={{ y: 24, opacity: 0, scale: 0.98 }}
						transition={{ type: 'spring', stiffness: 320, damping: 30 }}
					>
						<div className="border-line flex items-center justify-between border-b p-4">
							<h2 className="text-fg font-semibold">{title}</h2>
							<Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
								<X size={18} />
							</Button>
						</div>
						<div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
						{footer && (
							<div className="border-line flex justify-end gap-2 border-t p-4">{footer}</div>
						)}
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
