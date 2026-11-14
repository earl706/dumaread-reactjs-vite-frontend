import { AnimatePresence, motion } from 'framer-motion';

import { cn } from '../../lib/format';
import { AppMark } from './AppMark';

/** Shared easing for load ↔ ready handoffs. */
export const LOAD_FADE = { duration: 0.3, ease: [0.22, 1, 0.36, 1] };

export function LoadingScreen({ label = 'Loading…', className }) {
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={LOAD_FADE}
			className={cn(
				'text-muted flex h-full min-h-[40vh] flex-col items-center justify-center gap-3',
				className
			)}
		>
			<AppMark size={28} iconSize={14} pulse />
			<p className="text-sm">{label}</p>
		</motion.div>
	);
}

/** Placeholder that centers a small pulsating AppMark (covers, tiles, etc.). */
export function Skeleton({ className }) {
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={LOAD_FADE}
			className={cn('bg-surface-2 flex items-center justify-center rounded-md', className)}
			aria-hidden
		>
			<AppMark size={24} iconSize={12} pulse />
		</motion.div>
	);
}

/** Fade content in when it mounts after a load. */
export function FadeIn({ children, className }) {
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={LOAD_FADE}
			className={className}
		>
			{children}
		</motion.div>
	);
}

/**
 * Crossfade between a loading view and ready children.
 * Prefer this over bare ternaries so the loader can fade out.
 */
export function LoadSwap({ loading, loadingView, children, className }) {
	return (
		<AnimatePresence mode="wait">
			{loading ? (
				<motion.div
					key="loading"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={LOAD_FADE}
					className={className}
				>
					{loadingView}
				</motion.div>
			) : (
				<motion.div
					key="ready"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={LOAD_FADE}
					className={className}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	);
}

export function EmptyState({ icon: Icon, title, description, action }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0 }}
			transition={LOAD_FADE}
			className="border-line flex flex-col items-center justify-center gap-3 rounded-md border border-dashed p-10 text-center"
		>
			{Icon && (
				<div className="bg-surface-2 text-muted flex h-12 w-12 items-center justify-center rounded-sm">
					<Icon size={22} />
				</div>
			)}
			<div>
				<p className="text-fg font-medium">{title}</p>
				{description && <p className="text-muted mt-1 text-sm">{description}</p>}
			</div>
			{action}
		</motion.div>
	);
}
