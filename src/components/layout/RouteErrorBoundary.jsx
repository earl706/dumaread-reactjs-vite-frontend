import { Component } from 'react';
import { Link } from 'react-router-dom';

import { Button, EmptyState } from '../ui';

/**
 * Catches lazy-route / render failures so mobile LAN refreshes show a recovery
 * UI instead of a blank WebKit screen.
 */
export class RouteErrorBoundary extends Component {
	constructor(props) {
		super(props);
		this.state = { error: null };
	}

	static getDerivedStateFromError(error) {
		return { error };
	}

	componentDidCatch(error, info) {
		console.error('Route render failed', error, info);
	}

	render() {
		if (this.state.error) {
			return (
				<div className="bg-bg flex min-h-dvh items-center justify-center p-8">
					<EmptyState
						title="Something went wrong"
						description="This screen failed to load. Check that you’re online (or the book is saved offline), then try again."
						action={
							<div className="flex flex-col gap-2 sm:flex-row">
								<Button
									variant="secondary"
									onClick={() => {
										this.setState({ error: null });
										window.location.assign('/');
									}}
								>
									Go home
								</Button>
								<Button
									onClick={() => {
										this.setState({ error: null });
										window.location.reload();
									}}
								>
									Reload
								</Button>
							</div>
						}
					/>
					{/* Keep Link available for crawlers / a11y without relying on router state */}
					<Link to="/" className="sr-only">
						Home
					</Link>
				</div>
			);
		}
		return this.props.children;
	}
}
