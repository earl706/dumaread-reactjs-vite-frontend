import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';

import { booksApi } from '../../lib/resources';
import { useUIStore } from '../../stores/uiStore';

/**
 * The palette dialog body. Owns the search term so it resets automatically
 * each time the palette opens (the parent only mounts it while open).
 */
function PaletteDialog({ onClose }) {
	const navigate = useNavigate();
	const [term, setTerm] = useState('');
	const [debounced, setDebounced] = useState('');

	useEffect(() => {
		const id = setTimeout(() => setDebounced(term.trim()), 220);
		return () => clearTimeout(id);
	}, [term]);

	const { data, isFetching } = booksApi.useList(
		{ search: debounced, page_size: 8 },
		{ enabled: debounced.length > 1 }
	);
	const results = data?.results || [];

	const goTo = (book) => {
		onClose();
		navigate(`/books/${book.id}/read`);
	};

	return (
		<motion.div
			initial={{ y: -16, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			exit={{ y: -16, opacity: 0 }}
			className="border-line bg-surface relative w-full max-w-xl overflow-hidden rounded-lg border shadow-2xl"
			role="dialog"
			aria-label="Search"
		>
			<div className="border-line flex items-center gap-3 border-b px-4">
				<Search size={18} className="text-muted" />
				<input
					autoFocus
					value={term}
					onChange={(e) => setTerm(e.target.value)}
					placeholder="Search books…"
					className="text-fg placeholder:text-muted h-14 flex-1 bg-transparent outline-none"
				/>
				{isFetching && <span className="text-muted text-xs">…</span>}
			</div>

			<div className="max-h-80 overflow-y-auto p-2">
				{debounced.length <= 1 && (
					<p className="text-muted p-6 text-center text-sm">Type to search your library.</p>
				)}
				{debounced.length > 1 && !isFetching && results.length === 0 && (
					<p className="text-muted p-6 text-center text-sm">No results for “{debounced}”.</p>
				)}
				{results.map((item) => (
					<button
						key={item.id}
						onClick={() => goTo(item)}
						className="hover:bg-surface-2 flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm"
					>
						<Search size={16} className="text-muted" />
						<span className="text-fg flex-1 truncate">{item.title}</span>
						{item.status && <span className="text-muted text-xs capitalize">{item.status}</span>}
					</button>
				))}
			</div>
		</motion.div>
	);
}

/** Global search palette. Opens with Cmd/Ctrl+K. */
export function CommandPalette() {
	const { paletteOpen, closePalette, togglePalette } = useUIStore();

	useEffect(() => {
		const onKey = (e) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				togglePalette();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [togglePalette]);

	return (
		<AnimatePresence>
			{paletteOpen && (
				<motion.div
					className="fixed inset-0 z-[55] flex items-start justify-center p-4 pt-24"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
				>
					<div
						className="absolute inset-0 cursor-pointer bg-black/50 backdrop-blur-sm"
						onClick={closePalette}
					/>
					<PaletteDialog onClose={closePalette} />
				</motion.div>
			)}
		</AnimatePresence>
	);
}
