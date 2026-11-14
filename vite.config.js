import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
	// Load repo-root .env (VITE_*) so LAN phones and desktop share one config.
	envDir: path.resolve(rootDir, '..'),
	appType: 'spa',
	plugins: [
		react(),
		babel({ presets: [reactCompilerPreset()] }),
		tailwindcss(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.svg', 'pwa-192.png', 'pwa-512.png'],
			manifest: {
				name: 'Dumas',
				short_name: 'Dumas',
				description: 'Upload books, read in-app, and track progress — including offline.',
				theme_color: '#2d5a87',
				background_color: '#0f1419',
				display: 'standalone',
				start_url: '/',
				scope: '/',
				icons: [
					{ src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
					{
						src: 'pwa-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any maskable'
					}
				]
			},
			workbox: {
				navigateFallback: '/index.html',
				// App shell only — book files live in IndexedDB via Save offline.
				globPatterns: ['**/*.{js,css,html,ico,svg,woff2,png,webp}']
			},
			devOptions: {
				enabled: false
			}
		})
	],
	optimizeDeps: {
		include: ['epubjs', 'react-reader']
	},
	server: {
		// Phones on LAN need 0.0.0.0 — localhost-only binds are unreachable.
		host: true,
		port: 5173,
		strictPort: true,
		// Keep HMR websocket on the same host/port the phone opened (not 127.0.0.1).
		hmr: {
			clientPort: 5173
		},
		// Proxy /api to Django so the phone can use same-origin /api (not localhost).
		proxy: {
			'/api': {
				target: 'http://127.0.0.1:8000',
				changeOrigin: true
			}
		}
	},
	preview: {
		host: true,
		port: 4173,
		strictPort: true
	}
});
