import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, Search, Settings as SettingsIcon, Shield, Target } from 'lucide-react';

import { patch } from '../lib/api';
import { isMobileApp } from '../lib/desktop';
import { emptyGoalForm, goalFormFromRecord, parseGoalForm } from '../lib/readingGoals';
import { toast } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { useUIStore } from '../stores/uiStore';
import { MfaDisableSection, MfaSetupModal } from '../components/auth/MfaModals';
import { ReadingGoalsFields } from '../components/books/ReadingGoalsFields';
import { PageHeader } from '../components/layout/PageHeader';
import { Avatar, Button, Card, CardBody, CardHeader, Input } from '../components/ui';

export default function SettingsPage() {
	const user = useAuthStore((s) => s.user);
	const logout = useAuthStore((s) => s.logout);
	const updateUser = useAuthStore((s) => s.updateUser);
	const { theme, setTheme } = useThemeStore();
	const openPalette = useUIStore((s) => s.openPalette);
	const mobile = isMobileApp();
	const queryClient = useQueryClient();
	const [mfaSetupOpen, setMfaSetupOpen] = useState(false);
	const [newEmail, setNewEmail] = useState('');
	const [goalForm, setGoalForm] = useState(emptyGoalForm);

	useEffect(() => {
		if (user) setGoalForm(goalFormFromRecord(user));
	}, [user]);

	const saveName = useMutation({
		mutationFn: (body) => patch('/auth/me/', body),
		onSuccess: (data) => {
			updateUser(data);
			toast.success('Profile updated.');
		},
		onError: () => toast.error('Could not update profile.')
	});

	const saveGoals = useMutation({
		mutationFn: (body) => patch('/auth/me/', body),
		onSuccess: (data) => {
			updateUser(data);
			queryClient.invalidateQueries({ queryKey: ['books', 'stats'] });
			toast.success('Reading goals saved.');
		},
		onError: () => toast.error('Could not save reading goals.')
	});

	const changeEmail = useMutation({
		mutationFn: (email) => useAuthStore.getState().changeEmail(email),
		onSuccess: (data) => {
			toast.success(data.detail || 'Confirmation sent to your new email.');
			setNewEmail('');
		},
		onError: (err) => {
			toast.error(err.response?.data?.detail || 'Could not change email.');
		}
	});

	if (!user) return null;

	return (
		<div>
			<PageHeader
				title="Settings"
				icon={SettingsIcon}
				description="Manage your account and preferences."
			/>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{mobile && (
					<Card>
						<CardHeader title="Shortcuts" subtitle="Search used to live in the top bar" />
						<CardBody>
							<Button variant="secondary" className="w-full" onClick={openPalette}>
								<Search size={16} /> Search books
							</Button>
						</CardBody>
					</Card>
				)}
				<Card>
					<CardHeader title="Account" />
					<CardBody className="space-y-4">
						<div className="flex items-center gap-3">
							<Avatar name={user?.full_name || user?.email} src={user?.avatar_url} size={48} />
							<div>
								<p className="text-fg font-medium">{user?.full_name || 'Unnamed'}</p>
								<p className="text-muted text-sm">{user?.email}</p>
							</div>
						</div>
						<Input
							label="Full name"
							defaultValue={user?.full_name}
							onBlur={(e) =>
								e.target.value !== user?.full_name && saveName.mutate({ full_name: e.target.value })
							}
						/>
						<div className="space-y-2">
							<Input
								label="Email"
								type="email"
								value={newEmail}
								onChange={(e) => setNewEmail(e.target.value)}
								placeholder={user?.email}
							/>
							<Button
								type="button"
								variant="secondary"
								className="w-full"
								loading={changeEmail.isPending}
								disabled={!newEmail || newEmail.toLowerCase() === user?.email?.toLowerCase()}
								onClick={() => changeEmail.mutate(newEmail)}
							>
								Change email
							</Button>
							<p className="text-muted text-xs">
								We will send a confirmation link to the new address before it becomes active.
							</p>
						</div>
						<div>
							<span className="text-fg mb-1.5 block text-sm font-medium">Theme</span>
							<div className="flex gap-2">
								{['light', 'dark'].map((t) => (
									<button
										key={t}
										onClick={() => setTheme(t)}
										className={`flex-1 cursor-pointer rounded-md border px-4 py-2 text-sm capitalize ${
											theme === t ? 'border-primary text-primary' : 'border-line text-muted'
										}`}
									>
										{t}
									</button>
								))}
							</div>
						</div>
						<Button variant="danger" onClick={logout} className="w-full">
							<LogOut size={16} /> Sign out
						</Button>
					</CardBody>
				</Card>

				<Card>
					<CardHeader
						title="Two-factor authentication"
						subtitle="Protect your account with an authenticator app"
					/>
					<CardBody className="space-y-4">
						{user?.mfa_enabled ? (
							<MfaDisableSection />
						) : (
							<Button onClick={() => setMfaSetupOpen(true)}>
								<Shield size={16} /> Enable MFA
							</Button>
						)}
					</CardBody>
				</Card>

				<Card>
					<CardHeader
						title="Reading goals"
						subtitle="User-wide daily, weekly, and monthly minute targets"
						action={<Target size={18} className="text-muted" aria-hidden />}
					/>
					<CardBody className="space-y-4">
						<form
							id="user-goals-form"
							className="space-y-4"
							onSubmit={(e) => {
								e.preventDefault();
								saveGoals.mutate(parseGoalForm(goalForm));
							}}
						>
							<ReadingGoalsFields
								idPrefix="user-goal"
								form={goalForm}
								onChange={(field, value) =>
									setGoalForm((current) => ({ ...current, [field]: value }))
								}
							/>
							<Button type="submit" loading={saveGoals.isPending} className="w-full">
								Save reading goals
							</Button>
						</form>
					</CardBody>
				</Card>
			</div>
			<MfaSetupModal open={mfaSetupOpen} onClose={() => setMfaSetupOpen(false)} />
		</div>
	);
}
