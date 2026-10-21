import { BookOpen, Clock, Layers, BookMarked } from 'lucide-react';

import { useAuthStore } from '../stores/authStore';
import { booksApi } from '../lib/resources';
import { formatDurationSeconds } from '../lib/format';
import { PageHeader } from '../components/layout/PageHeader';
import { ActivityHeatmap, CompactActivityTile } from '../components/analytics/ActivityHeatmap';
import { Card, CardBody, CardHeader, StatCard } from '../components/ui';

function greeting() {
	const hour = new Date().getHours();
	if (hour < 12) return 'Good morning';
	if (hour < 18) return 'Good afternoon';
	return 'Good evening';
}

export default function DashboardPage() {
	const user = useAuthStore((s) => s.user);
	const name = user?.full_name?.split(' ')[0] || 'there';

	const { data: stats } = booksApi.useStats();
	const { data: activity } = booksApi.useActivity({ days: 365 });

	const timeline = activity?.timeline || [];

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

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{cards.map((stat) => (
					<StatCard key={stat.label} {...stat} />
				))}
			</div>

			<div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader title="Recent reading" subtitle="Minutes read over the last 12 weeks" />
					<CardBody>
						<CompactActivityTile timeline={timeline} weeks={12} emptyLabel="No reading yet" />
					</CardBody>
				</Card>

				<Card>
					<CardHeader title="Welcome to DumaRead" subtitle="Upload, read, and track in one place" />
					<CardBody>
						<p className="text-muted text-sm">
							Add a PDF, EPUB, or TXT from <span className="text-fg font-medium">Library</span>,
							then read it in the app. Progress uses real PDF pages and ~300-word pages for EPUB and
							TXT. Time tracks automatically while the reader is open.
						</p>
					</CardBody>
				</Card>
			</div>

			<Card className="mt-4">
				<CardHeader
					title="Reading this year"
					subtitle="Full contribution grid from GET /books/activity/"
				/>
				<CardBody>
					<ActivityHeatmap timeline={timeline} emptyLabel="No reading yet" />
				</CardBody>
			</Card>
		</div>
	);
}
