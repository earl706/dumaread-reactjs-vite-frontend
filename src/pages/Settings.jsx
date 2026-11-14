import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, LogOut, Search, Settings as SettingsIcon, Shield, Target } from 'lucide-react';

import { patch } from '../lib/api';
import { isMobileApp } from '../lib/desktop';
import { emptyGoalForm, goalFormFromRecord, parseGoalForm } from '../lib/readingGoals';
import { booksApi } from '../lib/resources';
import { useMergedUserGoalProgress } from '../hooks/useMergedUserGoalProgress';
import { toast } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';
import { useOfflineStore } from '../stores/offlineStore';
import { useThemeStore } from '../stores/themeStore';
import { useUIStore } from '../stores/uiStore';
import { MfaDisableSection, MfaSetupModal } from '../components/auth/MfaModals';
import { ReadingGoalsFields } from '../components/books/ReadingGoalsFields';
import { PageHeader } from '../components/layout/PageHeader';
import { SettingsPanel, SettingsTabBar, useSettingsTabs } from '../components/layout/SettingsTabs';
import { StickyPageChrome } from '../components/layout/StickyPageChrome';
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
	const { tabs, activeTab, setActiveTab } = useSettingsTabs({ mobile });
	const online = useOfflineStore((s) => s.online);
	const installPromptEvent = useOfflineStore((s) => s.installPromptEvent);
	const promptInstall = useOfflineStore((s) => s.promptInstall);
	const { data: stats } = booksApi.useStats({
		enabled: Boolean(user) && online,
		refetchInterval: online ? 60_000 : false,
		retry: online ? 1 : 0
	});
	const goalProgress = useMergedUserGoalProgress(stats?.goal_progress);

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
			<StickyPageChrome>
				<PageHeader
					title="Settings"
					icon={SettingsIcon}
					description="Manage your account and preferences."
					className="mb-0"
				/>
				<SettingsTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} wrap={mobile} />
			</StickyPageChrome>

			<div className="mx-auto max-w-7xl pt-4">
				{mobile && (
					<SettingsPanel id="shortcuts" active={activeTab}>
						<Card>
							<CardHeader title="Shortcuts" subtitle="Search used to live in the top bar" />
							<CardBody>
								<Button variant="secondary" className="w-full" onClick={openPalette}>
									<Search size={16} /> Search books
								</Button>
							</CardBody>
						</Card>
					</SettingsPanel>
				)}

				<SettingsPanel id="account" active={activeTab}>
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
									e.target.value !== user?.full_name &&
									saveName.mutate({ full_name: e.target.value })
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
							<div className="space-y-2">
								<span className="text-fg mb-1.5 block text-sm font-medium">Install app</span>
								{installPromptEvent ? (
									<Button
										type="button"
										variant="secondary"
										className="w-full"
										onClick={() => promptInstall()}
									>
										<Download size={16} /> Install Dumas
									</Button>
								) : (
									<p className="text-muted text-xs">
										On iPhone/iPad: Share → Add to Home Screen. On Android Chrome, an install prompt
										appears when available.
									</p>
								)}
							</div>
							<Button variant="danger" onClick={logout} className="w-full">
								<LogOut size={16} /> Sign out
							</Button>
						</CardBody>
					</Card>
				</SettingsPanel>

				<SettingsPanel id="security" active={activeTab}>
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
				</SettingsPanel>

				<SettingsPanel id="goals" active={activeTab}>
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
									progress={goalProgress}
									onChange={(field, value) =>
										setGoalForm((current) => ({ ...current, [field]: value }))
									}
									onReplace={setGoalForm}
								/>
								<Button type="submit" loading={saveGoals.isPending} className="w-full">
									Save reading goals
								</Button>
							</form>
						</CardBody>
					</Card>
				</SettingsPanel>
			</div>

			<MfaSetupModal open={mfaSetupOpen} onClose={() => setMfaSetupOpen(false)} />
		</div>
	);
}
