import { motion } from 'framer-motion';

import { cn } from '../../lib/format';
import { Card } from './Card';

const TREND_TONE = { up: 'text-success', down: 'text-danger', flat: 'text-muted' };

/** Compact metric tile for dashboards (value + label + optional icon/trend). */
export function StatCard({ icon: Icon, label, value, sublabel, tone = 'primary', trend, onClick }) {
	return (
		<Card
			as={onClick ? motion.button : motion.div}
			onClick={onClick}
			whileHover={onClick ? { y: -2 } : undefined}
			className={cn(
				'flex h-full w-full items-center gap-4 p-4 text-left',
				onClick && 'hover:border-primary/40 cursor-pointer'
			)}
		>
			{Icon && (
				<div
					className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm"
					style={{ background: `var(--${tone})`, opacity: 0.95 }}
				>
					<Icon size={20} className="text-white" />
				</div>
			)}
			<div className="min-w-0">
				<p className="text-fg text-2xl leading-tight font-semibold">{value}</p>
				<p className="text-muted truncate text-xs">{label}</p>
				{sublabel && (
					<p className={cn('text-xs', trend ? TREND_TONE[trend] : 'text-muted')}>{sublabel}</p>
				)}
			</div>
		</Card>
	);
}
