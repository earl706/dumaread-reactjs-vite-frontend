import { Zap } from 'lucide-react';

import { cn } from '../../lib/format';

/**
 * Brand mark (primary tile + Zap). Set `pulse` for loading states
 * (combined opacity + scale breathe).
 */
export function AppMark({ size = 36, iconSize = 18, pulse = false, className }) {
	return (
		<div
			className={cn(
				'bg-primary text-primary-fg flex shrink-0 items-center justify-center rounded-sm',
				pulse && 'appmark-pulse',
				className
			)}
			style={{ width: size, height: size }}
			aria-hidden={pulse ? undefined : true}
			role={pulse ? 'status' : undefined}
			aria-label={pulse ? 'Loading' : undefined}
		>
			<Zap size={iconSize} />
		</div>
	);
}
