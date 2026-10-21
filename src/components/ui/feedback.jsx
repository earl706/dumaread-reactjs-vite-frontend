import { motion } from 'framer-motion';

import { cn } from '../../lib/format';

function Spinner({ size = 24, className }) {
	return (
		<span
			role="status"
			aria-label="Loading"
			className={cn(
				'border-line border-t-primary inline-block animate-spin rounded-full border-2',
				className
			)}
			style={{ width: size, height: size }}
		/>
	);
}

export function LoadingScreen({ label = 'Loading…' }) {
	return (
		<div className="text-muted flex h-full min-h-[40vh] flex-col items-center justify-center gap-3">
			<Spinner size={28} />
			<p className="text-sm">{label}</p>
		</div>
	);
}

export function Skeleton({ className }) {
	return <div className={cn('bg-surface-2 animate-pulse rounded-md', className)} />;
}

export function EmptyState({ icon: Icon, title, description, action }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
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
