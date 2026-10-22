import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Layers, BookMarked } from 'lucide-react';

import { useAuthStore } from '../stores/authStore';
import { booksApi } from '../lib/resources';
import { formatDurationSeconds } from '../lib/format';
import { PageHeader } from '../components/layout/PageHeader';
import { ActivityHeatmap } from '../components/analytics/ActivityHeatmap';
import { RecentBookShortcut } from '../components/books/RecentBookShortcut';
import { Card, CardBody, CardHeader, StatCard } from '../components/ui';

function greeting() {
	const hour = new Date().getHours();
	if (hour < 12) return 'Good morning';
	if (hour < 18) return 'Good afternoon';
	return 'Good evening';
}

export default function DashboardPage() {
	const navigate = useNavigate();
	const user = useAuthStore((s) => s.user);
	const name = user?.full_name?.split(' ')[0] || 'there';

	const { data: stats } = booksApi.useStats();
	const { data: activity } = booksApi.useActivity({ days: 500 });
	const { data: recent, isLoading: recentLoading } = booksApi.useList({
		ordering: '-last_read_at',
		last_read_at__isnull: false,
		page_size: 5,
		page: 1
	});

	const timeline = activity?.timeline || [];
	const recentBooks = recent?.results || [];

	const cards = [
		{ icon: BookOpen, label: 'Books', value: stats?.total ?? '—', tone: 'primary' },
		{ icon: BookMarked, label: 'Currently reading', value: stats?.reading ?? '—', tone: 'success' },
		{ icon: Layers, label: 'Pages left', value: stats?.pages_left ?? '—', tone: 'warning' },
		{
			icon: Clock,
			label: 'Time read',
			value: stats ? formatDurationSeconds(stats.total_reading_seconds) : '—',
			tone: 'accent'
		}
	];

	return (
		<div>
			<PageHeader
				title={`${greeting()}, ${name}`}
				icon={BookOpen}
				description="Your library at a glance — pages left and time well spent."
			/>

			<Card className="mt-4">
				<CardHeader title="Reading activity" />
				<CardBody>
					<ActivityHeatmap timeline={timeline} emptyLabel="No reading yet" />
				</CardBody>
			</Card>

			{recentLoading || recentBooks.length ? (
				<Card className="mt-4">
					<CardHeader title="Recent Reads" />
					<CardBody>
						<div className="flex h-[150px] max-h-[150px] gap-4 overflow-x-auto">
							{recentLoading
								? Array.from({ length: 5 }, (_, i) => (
										<div
											key={i}
											className="bg-surface-2 h-full w-[calc((100%-4rem)/5)] min-w-[5.5rem] shrink-0 animate-pulse rounded-md"
										/>
									))
								: recentBooks.map((book) => (
										<RecentBookShortcut
											key={book.id}
											book={book}
											onOpen={() => navigate(`/books/${book.id}/read`)}
										/>
									))}
						</div>
					</CardBody>
				</Card>
			) : null}
		</div>
	);
}
