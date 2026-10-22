import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus } from 'lucide-react';

import { booksApi } from '../lib/resources';
import { ACCEPTED_BOOK_TYPES, MAX_BOOK_BYTES, formatLabel } from '../lib/reading';
import { formatFromName, previewBookFile } from '../lib/bookPreview';
import { STATUS_LABELS } from '../lib/status';
import { formatDate, formatDurationSeconds } from '../lib/format';
import { toast } from '../stores/toastStore';
import { useListControls } from '../hooks/useListControls';
import { PageHeader } from '../components/layout/PageHeader';
import { BookCard } from '../components/books/BookCard';
import { UploadPreview } from '../components/books/UploadPreview';
import {
	Button,
	EmptyState,
	Input,
	ListToolbar,
	LoadingScreen,
	Modal,
	Pagination,
	RecordInfoModal,
	Select
} from '../components/ui';

const DEFAULT_ORDERING = '-created_at';
const GRID_PAGE_SIZE = 6;

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

const EMPTY_FORM = { title: '', author: '', status: 'unread', file: null };
const EMPTY_PREVIEW = { status: 'idle', coverUrl: null, format: '', pageCount: null };

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
	} = useListControls({ defaultOrdering: DEFAULT_ORDERING, pageSize: GRID_PAGE_SIZE });

	const { data, isLoading, isError } = booksApi.useList(queryParams);
	const books = data?.results || [];

	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState(null);
	const [infoRow, setInfoRow] = useState(null);
	const [form, setForm] = useState(EMPTY_FORM);
	const [preview, setPreview] = useState(EMPTY_PREVIEW);

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
		setPreview(EMPTY_PREVIEW);
		setModalOpen(true);
	};

	const openEdit = (book) => {
		setEditing(book);
		setForm({
			title: book.title || '',
			author: book.author || '',
			status: book.status || 'unread',
			file: null
		});
		setModalOpen(true);
	};

	const closeModal = () => {
		setModalOpen(false);
		setEditing(null);
		setForm(EMPTY_FORM);
		setPreview(EMPTY_PREVIEW);
	};

	useEffect(() => {
		if (editing || !form.file) {
			setPreview(EMPTY_PREVIEW);
			return undefined;
		}
		const file = form.file;
		let cancelled = false;
		let coverUrl = null;
		setPreview({
			status: 'loading',
			coverUrl: null,
			format: formatFromName(file.name),
			pageCount: null
		});
		previewBookFile(file)
			.then((result) => {
				if (cancelled) {
					if (result.coverUrl) URL.revokeObjectURL(result.coverUrl);
					return;
				}
				coverUrl = result.coverUrl;
				setPreview({
					status: 'ready',
					coverUrl: result.coverUrl,
					format: result.format,
					pageCount: result.pageCount
				});
				setForm((current) => {
					if (current.file !== file) return current;
					return {
						...current,
						title: current.title.trim() ? current.title : result.title || '',
						author: current.author.trim() ? current.author : result.author || ''
					};
				});
			})
			.catch(() => {
				if (cancelled) return;
				setPreview({
					status: 'ready',
					coverUrl: null,
					format: formatFromName(file.name),
					pageCount: null
				});
				setForm((current) => {
					if (current.file !== file) return current;
					const stem = file.name.replace(/\.[^.]+$/, '') || 'Untitled';
					return {
						...current,
						title: current.title.trim() ? current.title : stem
					};
				});
			});
		return () => {
			cancelled = true;
			if (coverUrl) URL.revokeObjectURL(coverUrl);
		};
	}, [editing, form.file]);

	const submit = (e) => {
		e.preventDefault();
		if (editing) {
			updateBook.mutate({
				id: editing.id,
				title: form.title,
				author: form.author,
				status: form.status
			});
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
		if (form.title.trim()) body.append('title', form.title.trim());
		if (form.author.trim()) body.append('author', form.author.trim());
		createBook.mutate(body);
	};

	const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
	const saving = createBook.isPending || updateBook.isPending;
	const openReader = (book) => navigate(`/books/${book.id}/read`);

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
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{books.map((book) => (
						<BookCard
							key={book.id}
							book={book}
							onRead={openReader}
							onEdit={openEdit}
							onInfo={setInfoRow}
							onDelete={(row) => removeBook.mutate(row.id)}
						/>
					))}
				</div>
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
							className="cursor-pointer"
							onChange={(e) =>
								setForm((f) => ({
									...f,
									file: e.target.files?.[0] || null,
									title: '',
									author: ''
								}))
							}
							required
						/>
					)}
					{!editing && form.file ? (
						<UploadPreview
							key={`${form.file.name}-${form.file.size}-${form.file.lastModified}`}
							status={preview.status}
							coverUrl={preview.coverUrl}
							format={preview.format}
							pageCount={preview.pageCount}
						/>
					) : null}
					<Input
						label="Title"
						value={form.title}
						onChange={setField('title')}
						placeholder={editing ? 'Book title' : 'Optional — extracted from the book'}
						required={Boolean(editing)}
					/>
					<Input
						label="Author"
						value={form.author}
						onChange={setField('author')}
						placeholder={editing ? 'Optional' : 'Optional — extracted from the book'}
					/>
					{editing && (
						<Select label="Status" value={form.status} onChange={setField('status')}>
							{STATUS_SELECT.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</Select>
					)}
				</form>
			</Modal>
		</div>
	);
}
