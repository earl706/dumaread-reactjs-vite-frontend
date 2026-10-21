import { create } from 'zustand';

// CUSTOMIZE: Rename this key when you rebrand the app.
const COLLAPSE_KEY = 'app-sidebar-collapsed';

function readCollapsed() {
	try {
		return localStorage.getItem(COLLAPSE_KEY) === '1';
	} catch {
		return false;
	}
}

function writeCollapsed(collapsed) {
	try {
		localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
	} catch {
		/* ignore quota / private mode */
	}
}

/** Ephemeral UI state: sidebar (mobile + desktop collapse) and command palette. */
export const useUIStore = create((set) => ({
	sidebarOpen: false,
	sidebarCollapsed: typeof window !== 'undefined' ? readCollapsed() : false,
	paletteOpen: false,

	toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
	closeSidebar: () => set({ sidebarOpen: false }),
	toggleSidebarCollapsed: () =>
		set((s) => {
			const sidebarCollapsed = !s.sidebarCollapsed;
			writeCollapsed(sidebarCollapsed);
			return { sidebarCollapsed };
		}),
	setSidebarCollapsed: (sidebarCollapsed) => {
		writeCollapsed(sidebarCollapsed);
		set({ sidebarCollapsed });
	},
	openPalette: () => set({ paletteOpen: true }),
	closePalette: () => set({ paletteOpen: false }),
	togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen }))
}));
