import { cn } from '../../lib/format';

const VARIANTS = {
	primary: 'bg-primary text-primary-fg hover:opacity-90 shadow-sm shadow-primary/20',
	secondary: 'bg-surface-2 text-fg hover:bg-line border border-line',
	ghost: 'text-muted hover:text-fg hover:bg-surface-2',
	danger: 'bg-danger text-white hover:opacity-90',
	outline: 'border border-line text-fg hover:bg-surface-2'
};

const SIZES = {
	sm: 'h-8 px-3 text-sm gap-1.5',
	md: 'h-10 px-4 text-sm gap-2',
	lg: 'h-12 px-6 text-base gap-2',
	icon: 'h-9 w-9 justify-center'
};

/**
 * Accessible button. Forwards all native props (type, onClick, aria-*),
 * disables itself while `loading`, and renders an optional leading icon.
 */
export function Button({
	variant = 'primary',
	size = 'md',
	className,
	loading = false,
	disabled,
	children,
	...props
}) {
	return (
		<button
			className={cn(
				'inline-flex cursor-pointer items-center rounded-md font-medium transition-all duration-150',
				'focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2',
				'disabled:pointer-events-none disabled:opacity-50',
				VARIANTS[variant],
				SIZES[size],
				className
			)}
			disabled={disabled || loading}
			aria-busy={loading || undefined}
			{...props}
		>
			{loading && (
				<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
			)}
			{children}
		</button>
	);
}
