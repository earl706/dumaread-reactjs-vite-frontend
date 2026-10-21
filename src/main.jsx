import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import App from './App.jsx';
import { isMobileApp } from './lib/desktop';

if (isMobileApp()) {
	document.documentElement.classList.add('mobile-app');
	// Keep WKWebView from pinch/focus-zooming into fields.
	document
		.querySelector('meta[name="viewport"]')
		?.setAttribute(
			'content',
			'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover'
		);
}

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<App />
	</StrictMode>
);
