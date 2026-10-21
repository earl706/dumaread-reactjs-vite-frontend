import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { get, post } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import { useAuthStore } from '../../stores/authStore';
import { Button, Input, Modal } from '../ui';

export function MfaPromptModal({ open, onClose }) {
	const updateUser = useAuthStore((s) => s.updateUser);
	const dismiss = useMutation({
		mutationFn: () => post('/auth/mfa/dismiss-prompt/'),
		onSuccess: () => {
			updateUser({ show_mfa_prompt: false });
			onClose();
		}
	});
	return (
		<Modal open={open} onClose={onClose} title="Secure your account">
			<div className="space-y-4">
				<div className="bg-primary/10 text-primary flex items-center gap-3 rounded-md p-4">
					<ShieldCheck size={24} />
					<p className="text-sm">
						Add two-factor authentication so only you can sign in, even if your password is
						compromised.
					</p>
				</div>
				<div className="flex gap-2">
					<Button className="flex-1" onClick={onClose}>
						Set up now
					</Button>
					<Button
						variant="secondary"
						className="flex-1"
						loading={dismiss.isPending}
						onClick={() => dismiss.mutate()}
					>
						Not now
					</Button>
				</div>
			</div>
		</Modal>
	);
}

export function MfaSetupModal({ open, onClose, onEnabled }) {
	const [step, setStep] = useState('qr');
	const [setup, setSetup] = useState(null);
	const [code, setCode] = useState('');
	const [recoveryCodes, setRecoveryCodes] = useState([]);
	const updateUser = useAuthStore((s) => s.updateUser);

	const start = useMutation({
		mutationFn: () => get('/auth/mfa/setup/'),
		onSuccess: (data) => {
			setSetup(data);
			setStep('verify');
		},
		onError: () => toast.error('Could not start MFA setup.')
	});

	const confirm = useMutation({
		mutationFn: () => post('/auth/mfa/setup/confirm/', { code }),
		onSuccess: (data) => {
			setRecoveryCodes(data.recovery_codes);
			setStep('codes');
			updateUser({ mfa_enabled: true, show_mfa_prompt: false });
			onEnabled?.();
		},
		onError: () => toast.error('Invalid code. Try again.')
	});

	const reset = () => {
		setStep('qr');
		setSetup(null);
		setCode('');
		setRecoveryCodes([]);
	};

	const handleClose = () => {
		reset();
		onClose();
	};

	useEffect(() => {
		if (open) start.mutate();
	}, [open]);

	return (
		<Modal open={open} onClose={handleClose} title="Set up two-factor authentication">
			{step === 'verify' && setup && (
				<div className="space-y-4">
					<p className="text-muted text-sm">
						Scan this QR code with your authenticator app, then enter the 6-digit code.
					</p>
					<img
						src={`data:image/png;base64,${setup.qr_png_base64}`}
						alt="MFA QR code"
						className="border-line mx-auto rounded-md border"
						width={180}
						height={180}
					/>
					<p className="text-muted text-center font-mono text-xs break-all">{setup.secret}</p>
					<Input
						label="Authentication code"
						value={code}
						onChange={(e) => setCode(e.target.value)}
						placeholder="123456"
						inputMode="numeric"
						autoComplete="one-time-code"
					/>
					<Button
						className="w-full"
						loading={confirm.isPending}
						disabled={code.length < 6}
						onClick={() => confirm.mutate()}
					>
						Verify and enable
					</Button>
				</div>
			)}
			{step === 'codes' && (
				<div className="space-y-4">
					<p className="text-muted text-sm">
						Save these recovery codes somewhere safe. Each can be used once if you lose your
						authenticator.
					</p>
					<div className="bg-bg border-line grid grid-cols-2 gap-2 rounded-md border p-4 font-mono text-sm">
						{recoveryCodes.map((c) => (
							<span key={c}>{c}</span>
						))}
					</div>
					<Button className="w-full" onClick={handleClose}>
						Done
					</Button>
				</div>
			)}
			{step === 'qr' && start.isPending && <p className="text-muted text-sm">Preparing setup…</p>}
		</Modal>
	);
}

export function MfaDisableSection() {
	const [code, setCode] = useState('');
	const updateUser = useAuthStore((s) => s.updateUser);
	const disable = useMutation({
		mutationFn: () => post('/auth/mfa/disable/', { code }),
		onSuccess: () => {
			updateUser({ mfa_enabled: false });
			setCode('');
			toast.success('Two-factor authentication disabled.');
		},
		onError: () => toast.error('Invalid code.')
	});
	return (
		<div className="space-y-3">
			<Input
				label="Authentication code"
				value={code}
				onChange={(e) => setCode(e.target.value)}
				placeholder="123456"
				inputMode="numeric"
			/>
			<Button
				variant="danger"
				loading={disable.isPending}
				disabled={code.length < 6}
				onClick={() => disable.mutate()}
			>
				Disable MFA
			</Button>
		</div>
	);
}
