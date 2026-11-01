import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus } from 'lucide-react';

import { booksApi } from '../lib/resources';
import { ACCEPTED_BOOK_TYPES, MAX_BOOK_BYTES, formatLabel } from '../lib/reading';
import { formatFromName, previewBookFile } from '../lib/bookPreview';
import {
	emptyGoalForm,
	exceedingGoalPeriods,
	goalFormFromRecord,
	parseGoalForm
} from '../lib/readingGoals';
import { STATUS_LABELS } from '../lib/status';
import { formatDate, formatDurationSeconds } from '../lib/format';
import { toast } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';
import { useListControls } from '../hooks/useListControls';
import { PageHeader } from '../components/layout/PageHeader';
import { BookCard } from '../components/books/BookCard';
import { ReadingGoalsFields } from '../components/books/ReadingGoalsFields';
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
	const user = useAuthStore((s) => s.user);
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
	const [deleting, setDeleting] = useState(null);
	const [goalsBook, setGoalsBook] = useState(null);
	const [goalForm, setGoalForm] = useState(emptyGoalForm);
	const [pendingGoals, setPendingGoals] = useState(null);
	const [exceededPeriods, setExceededPeriods] = useState([]);
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
	const updateGoals = booksApi.useUpdate({
		onSuccess: () => {
			toast.success('Reading goals saved.');
			closeGoalsModal();
		},
		onError: (err) => toast.error(errorMessage(err, 'Could not save reading goals.'))
	});
	const removeBook = booksApi.useRemove({
		onSuccess: () => {
			toast.success('Book deleted.');
			setDeleting(null);
		}
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

	const openGoals = (book) => {
		setGoalsBook(book);
		setGoalForm(goalFormFromRecord(book));
		setPendingGoals(null);
		setExceededPeriods([]);
	};

	const closeGoalsModal = () => {
		if (updateGoals.isPending) return;
		setGoalsBook(null);
		setGoalForm(emptyGoalForm());
		setPendingGoals(null);
		setExceededPeriods([]);
	};

	const saveGoals = (goals) => {
		if (!goalsBook) return;
		updateGoals.mutate({ id: goalsBook.id, ...goals });
	};

	const submitGoals = (e) => {
		e.preventDefault();
		const goals = parseGoalForm(goalForm);
		const exceeded = exceedingGoalPeriods(goals, user);
		if (exceeded.length) {
			setPendingGoals(goals);
			setExceededPeriods(exceeded);
			return;
		}
		saveGoals(goals);
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
							onDelete={setDeleting}
							onGoals={openGoals}
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
				open={Boolean(deleting)}
				onClose={() => !removeBook.isPending && setDeleting(null)}
				title="Delete book"
				size="sm"
				footer={
					<>
						<Button
							variant="secondary"
							onClick={() => setDeleting(null)}
							disabled={removeBook.isPending}
						>
							Cancel
						</Button>
						<Button
							variant="danger"
							loading={removeBook.isPending}
							onClick={() => deleting && removeBook.mutate(deleting.id)}
						>
							Delete
						</Button>
					</>
				}
			>
				<p className="text-muted text-sm">
					Delete <span className="text-fg font-medium">{deleting?.title || 'this book'}</span>? This
					removes the file and reading progress. This cannot be undone.
				</p>
			</Modal>

			<Modal
				open={Boolean(goalsBook) && !pendingGoals}
				onClose={closeGoalsModal}
				title={`Goals · ${goalsBook?.title || 'Book'}`}
				footer={
					<>
						<Button variant="secondary" onClick={closeGoalsModal} disabled={updateGoals.isPending}>
							Cancel
						</Button>
						<Button type="submit" form="book-goals-form" loading={updateGoals.isPending}>
							Save goals
						</Button>
					</>
				}
			>
				<form id="book-goals-form" onSubmit={submitGoals} className="space-y-4">
					<p className="text-muted text-sm">
						Set optional minute targets for this book. These are independent of your user-wide goals
						in Settings.
					</p>
					<ReadingGoalsFields
						idPrefix="book-goal"
						form={goalForm}
						onChange={(field, value) => setGoalForm((current) => ({ ...current, [field]: value }))}
					/>
				</form>
			</Modal>

			<Modal
				open={Boolean(pendingGoals)}
				onClose={() => {
					if (updateGoals.isPending) return;
					setPendingGoals(null);
					setExceededPeriods([]);
				}}
				title="Goals exceed user-wide targets"
				size="sm"
				footer={
					<>
						<Button
							variant="secondary"
							onClick={() => {
								setPendingGoals(null);
								setExceededPeriods([]);
							}}
							disabled={updateGoals.isPending}
						>
							Cancel
						</Button>
						<Button
							loading={updateGoals.isPending}
							onClick={() => pendingGoals && saveGoals(pendingGoals)}
						>
							Save anyway
						</Button>
					</>
				}
			>
				<p className="text-muted text-sm">
					Some book goals are higher than your matching user-wide goals:
				</p>
				<ul className="text-fg mt-3 list-disc space-y-1 pl-5 text-sm">
					{exceededPeriods.map((item) => (
						<li key={item.key}>
							{item.label}: {item.book} min (user-wide {item.user} min)
						</li>
					))}
				</ul>
			</Modal>

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
