import { cn } from '../../lib/format';

/**
 * Sticky blurred title chrome that bleeds to the main padding edges.
 * `-mt-6` cancels AppLayout’s `py-6` so rest and stuck share one top inset
 * (`pt` matching that page padding, max’d with safe-area).
 */
export function StickyPageChrome({ children, className }) {
	return (
		<div
			className={cn(
				'bg-bg/95 sticky top-0 z-20 -mx-4 -mt-6 space-y-3 px-4 pb-3',
				'pt-[max(1.5rem,env(safe-area-inset-top))]',
				'supports-[backdrop-filter]:bg-bg/80 backdrop-blur',
				'sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8',
				className
			)}
		>
			{children}
		</div>
	);
}
