import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus } from 'lucide-react';

import { booksApi } from '../lib/resources';
import { isMobileApp } from '../lib/desktop';
import { ACCEPTED_BOOK_TYPES, MAX_BOOK_BYTES, formatLabel } from '../lib/reading';
import { STATUS_LABELS, STATUS_TONE } from '../lib/status';
import { formatDate, formatDurationSeconds } from '../lib/format';
import { toast } from '../stores/toastStore';
import { useListControls } from '../hooks/useListControls';
import { PageHeader } from '../components/layout/PageHeader';
import {
	Badge,
	Button,
	DataSheet,
	EmptyState,
	Input,
	ListToolbar,
	LoadingScreen,
	Modal,
	Pagination,
	ProgressBar,
	RecordInfoModal,
	Select,
	Table
} from '../components/ui';

const DEFAULT_ORDERING = '-created_at';

const SORT_OPTIONS = [
	{ value: '-created_at', label: 'Newest first' },
	{ value: 'created_at', label: 'Oldest first' },
	{ value: 'title', label: 'Title A–Z' },
	{ value: '-title', label: 'Title Z–A' },
	{ value: 'status', label: 'Status' },
	{ value: '-last_read_at', label: 'Recently read' }
];

const STATUS_OPTIONS = [
	{ value: '', label: 'All statuses' },
	{ value: 'unread', label: 'Unread' },
	{ value: 'reading', label: 'Reading' },
	{ value: 'completed', label: 'Completed' },
	{ value: 'archived', label: 'Archived' }
];

const FORMAT_OPTIONS = [
	{ value: '', label: 'All formats' },
	{ value: 'pdf', label: 'PDF' },
	{ value: 'epub', label: 'EPUB' },
	{ value: 'txt', label: 'TXT' }
];

const STATUS_SELECT = [
	{ value: 'unread', label: 'Unread' },
	{ value: 'reading', label: 'Reading' },
	{ value: 'completed', label: 'Completed' },
	{ value: 'archived', label: 'Archived' }
];

const EMPTY_FORM = { title: '', author: '', file: null };

function firstError(value) {
	if (typeof value === 'string') return value;
	if (Array.isArray(value) && value.length) return firstError(value[0]);
	if (value && typeof value === 'object') {
		const nested = Object.values(value)[0];
		if (nested != null) return firstError(nested);
	}
	return null;
}

function errorMessage(err, fallback) {
	const data = err?.response?.data;
	if (!data) return fallback;
	if (typeof data.detail === 'string') return data.detail;
	return firstError(data) || fallback;
}

export default function BooksPage() {
	const navigate = useNavigate();
	const mobile = isMobileApp();
	const {
		search,
		setSearch,
		ordering,
		setOrdering,
		filters,
		setFilter,
		queryParams,
		setPage,
		page
	} = useListControls({ defaultOrdering: DEFAULT_ORDERING });

	const { data, isLoading, isError } = booksApi.useList(queryParams);
	const books = data?.results || [];

	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState(null);
	const [infoRow, setInfoRow] = useState(null);
	const [form, setForm] = useState(EMPTY_FORM);

	const createBook = booksApi.useCreate({
		onSuccess: () => {
			toast.success('Book uploaded.');
			closeModal();
		},
		onError: (err) => toast.error(errorMessage(err, 'Could not upload this book.'))
	});
	const updateBook = booksApi.useUpdate({
		onSuccess: () => {
			toast.success('Book updated.');
			closeModal();
		}
	});
	const removeBook = booksApi.useRemove({
		onSuccess: () => toast.success('Book deleted.')
	});

	const openCreate = () => {
		setEditing(null);
		setForm(EMPTY_FORM);
		setModalOpen(true);
	};

	const openEdit = (book) => {
		setEditing(book);
		setForm({ title: book.title || '', author: book.author || '', file: null });
		setModalOpen(true);
	};

	const closeModal = () => {
		setModalOpen(false);
		setEditing(null);
		setForm(EMPTY_FORM);
	};

	const submit = (e) => {
		e.preventDefault();
		if (editing) {
			updateBook.mutate({ id: editing.id, title: form.title, author: form.author });
			return;
		}
		if (!form.file) {
			toast.error('Choose a .pdf, .epub, or .txt file.');
			return;
		}
		if (form.file.size > MAX_BOOK_BYTES) {
			toast.error('File must be 50 MB or smaller.');
			return;
		}
		const body = new FormData();
		body.append('file', form.file);
		const title = form.title.trim() || form.file.name.replace(/\.[^.]+$/, '');
		body.append('title', title);
		if (form.author.trim()) body.append('author', form.author.trim());
		createBook.mutate(body);
	};

	const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
	const saving = createBook.isPending || updateBook.isPending;
	const openReader = (book) => navigate(`/books/${book.id}/read`);

	const columns = useMemo(
		() => [
			{
				key: 'title',
				label: 'Title',
				editable: true,
				required: true,
				className: 'w-[22%]'
			},
			{
				key: 'author',
				label: 'Author',
				editable: true,
				className: 'w-[14%]'
			},
			{
				key: 'format',
				label: 'Format',
				getDisplay: (row) => formatLabel(row.format),
				className: 'w-[8%]'
			},
			{
				key: 'status',
				label: 'Status',
				type: 'select',
				editable: true,
				options: STATUS_SELECT,
				render: (row) => (
					<Badge tone={STATUS_TONE[row.status] || 'neutral'} className="capitalize">
						{STATUS_LABELS[row.status] || row.status}
					</Badge>
				),
				className: 'w-[12%]'
			},
			{
				key: 'progress',
				label: 'Progress',
				render: (row) => (
					<div className="min-w-[8rem]">
						<ProgressBar value={row.progress_percent || 0} showLabel />
						<p className="text-muted mt-1 text-xs">
							{row.current_page || 0}/{row.page_count || 0} · {row.pages_left || 0} left
						</p>
					</div>
				),
				className: 'w-[16%]'
			},
			{
				key: 'total_reading_seconds',
				label: 'Time',
				getDisplay: (row) => formatDurationSeconds(row.total_reading_seconds) || '0s',
				sortKey: 'total_reading_seconds',
				className: 'w-[10%]'
			},
			{
				key: 'read',
				label: '',
				render: (row) => (
					<Button size="sm" onClick={() => openReader(row)}>
						Read
					</Button>
				),
				className: 'w-[8%]'
			},
			{
				key: 'actions',
				label: '',
				type: 'actions',
				actions: ['info', 'delete'],
				className: 'w-16'
			}
		],
		[]
	);

	const tableColumns = useMemo(
		() => columns.filter((col) => col.type !== 'actions' && col.key !== 'read'),
		[columns]
	);

	return (
		<div>
			<PageHeader
				title="Library"
				icon={BookOpen}
				description="Upload a book and pick up where you left off."
				actions={
					<Button onClick={openCreate}>
						<Plus size={16} /> Upload book
					</Button>
				}
			/>

			<ListToolbar
				search={search}
				onSearchChange={setSearch}
				searchPlaceholder="Search books…"
				ordering={ordering}
				onOrderingChange={setOrdering}
				sortOptions={SORT_OPTIONS}
				filters={[
					{
						key: 'status',
						label: 'Status',
						value: filters.status || '',
						onChange: (v) => setFilter('status', v),
						options: STATUS_OPTIONS
					},
					{
						key: 'format',
						label: 'Format',
						value: filters.format || '',
						onChange: (v) => setFilter('format', v),
						options: FORMAT_OPTIONS
					}
				]}
			/>

			{isLoading ? (
				<LoadingScreen />
			) : isError ? (
				<EmptyState
					icon={BookOpen}
					title="Could not load your library"
					description="Something went wrong while fetching your books."
				/>
			) : books.length === 0 ? (
				<EmptyState
					icon={BookOpen}
					title="No books yet"
					description="Upload a PDF, EPUB, or TXT file to start reading."
					action={
						<Button onClick={openCreate}>
							<Plus size={16} /> Upload book
						</Button>
					}
				/>
			) : mobile ? (
				<Table
					rows={books}
					columns={tableColumns}
					ordering={ordering}
					defaultOrdering={DEFAULT_ORDERING}
					onOrderingChange={setOrdering}
					onRowClick={openReader}
					emptyMessage="No books match these filters."
					rowLabel={(row) => row.title || 'book'}
				/>
			) : (
				<DataSheet
					rows={books}
					columns={columns}
					ordering={ordering}
					defaultOrdering={DEFAULT_ORDERING}
					onOrderingChange={setOrdering}
					onCommit={({ id, field, value, patch }) => {
						updateBook.mutate({ id, ...(patch || { [field]: value }) });
					}}
					onAdd={openCreate}
					onRequestDelete={(row) => removeBook.mutate(row.id)}
					onRequestInfo={setInfoRow}
					adding={createBook.isPending}
					saving={updateBook.isPending}
					addLabel="Upload book"
					emptyMessage="No books match these filters."
					rowLabel={(row) => row.title || 'book'}
				/>
			)}

			<Pagination
				page={page}
				totalPages={data?.total_pages || 1}
				count={data?.count || 0}
				pageSize={queryParams.page_size}
				onPageChange={setPage}
			/>

			<RecordInfoModal
				open={Boolean(infoRow)}
				onClose={() => setInfoRow(null)}
				title={infoRow?.title || 'Book'}
				fields={
					infoRow
						? [
								{ label: 'Title', value: infoRow.title },
								{ label: 'Author', value: infoRow.author || '—' },
								{ label: 'Format', value: formatLabel(infoRow.format) },
								{ label: 'Status', value: STATUS_LABELS[infoRow.status] || infoRow.status },
								{
									label: 'Progress',
									value: `${infoRow.current_page || 0} / ${infoRow.page_count || 0} (${infoRow.pages_left || 0} left)`
								},
								{
									label: 'Time',
									value: formatDurationSeconds(infoRow.total_reading_seconds)
								},
								{ label: 'Uploaded', value: formatDate(infoRow.created_at) || '—' }
							]
						: []
				}
			/>

			<Modal
				open={modalOpen}
				onClose={closeModal}
				title={editing ? 'Edit book' : 'Upload book'}
				footer={
					<>
						<Button variant="secondary" onClick={closeModal}>
							Cancel
						</Button>
						<Button
							type="submit"
							form="book-form"
							loading={saving}
							disabled={editing ? !form.title.trim() : !form.file}
						>
							{editing ? 'Save changes' : 'Upload'}
						</Button>
					</>
				}
			>
				<form id="book-form" onSubmit={submit} className="space-y-4">
					{!editing && (
						<Input
							label="File"
							type="file"
							accept={ACCEPTED_BOOK_TYPES}
							onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
							required
						/>
					)}
					<Input
						label="Title"
						value={form.title}
						onChange={setField('title')}
						placeholder={editing ? 'Book title' : 'Optional — defaults to the filename'}
						required={Boolean(editing)}
					/>
					<Input
						label="Author"
						value={form.author}
						onChange={setField('author')}
						placeholder="Optional"
					/>
				</form>
			</Modal>
		</div>
	);
}
