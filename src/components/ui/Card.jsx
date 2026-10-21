import { cn } from '../../lib/format';

export function Card({ className, as: Tag = 'div', ...props }) {
	return <Tag className={cn('border-line bg-surface rounded-md border', className)} {...props} />;
}

export function CardHeader({ className, title, subtitle, action, children }) {
	return (
		<div className={cn('flex items-start justify-between gap-3 p-5', className)}>
			<div className="min-w-0">
				{title && <h3 className="text-fg truncate font-semibold">{title}</h3>}
				{subtitle && <p className="text-muted mt-0.5 text-sm">{subtitle}</p>}
				{children}
			</div>
			{action}
		</div>
	);
}

export function CardBody({ className, ...props }) {
	return <div className={cn('p-5 pt-0', className)} {...props} />;
}
