import { useEffect, useRef } from 'react';

import { cn } from '../../lib/format';

const DIGIT_COUNT = 6;

/**
 * Six-slot numeric PIN. Calls onComplete(code) when all digits are filled.
 */
export default function PinInput({
	value = '',
	onChange,
	onComplete,
	disabled = false,
	error = false,
	autoFocus = true,
	length = DIGIT_COUNT,
	idPrefix = 'pin'
}) {
	const digits = Array.from({ length }, (_, i) => value[i] || '');
	const refs = useRef([]);

	useEffect(() => {
		if (autoFocus && !disabled) {
			refs.current[0]?.focus();
		}
	}, [autoFocus, disabled]);

	const emit = (next) => {
		const clipped = next.slice(0, length).replace(/\D/g, '');
		onChange?.(clipped);
		if (clipped.length === length) {
			onComplete?.(clipped);
		}
	};

	const setAt = (index, char) => {
		const next = digits.map((d, i) => (i === index ? char : d));
		emit(next.join(''));
	};

	const handleChange = (index, raw) => {
		const cleaned = raw.replace(/\D/g, '');
		if (!cleaned) {
			setAt(index, '');
			return;
		}
		if (cleaned.length > 1) {
			const merged = (value.slice(0, index) + cleaned).slice(0, length);
			emit(merged);
			const focusAt = Math.min(merged.length, length - 1);
			refs.current[focusAt]?.focus();
			return;
		}
		setAt(index, cleaned);
		if (index < length - 1) {
			refs.current[index + 1]?.focus();
		}
	};

	const handleKeyDown = (index, e) => {
		if (e.key === 'Backspace') {
			if (digits[index]) {
				setAt(index, '');
			} else if (index > 0) {
				e.preventDefault();
				setAt(index - 1, '');
				refs.current[index - 1]?.focus();
			}
			return;
		}
		if (e.key === 'ArrowLeft' && index > 0) {
			e.preventDefault();
			refs.current[index - 1]?.focus();
		}
		if (e.key === 'ArrowRight' && index < length - 1) {
			e.preventDefault();
			refs.current[index + 1]?.focus();
		}
	};

	const handlePaste = (e) => {
		e.preventDefault();
		const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, length);
		if (!pasted) return;
		emit(pasted);
		refs.current[Math.min(pasted.length, length) - 1]?.focus();
	};

	return (
		<div className="flex justify-center gap-2" onPaste={handlePaste}>
			{digits.map((digit, index) => (
				<input
					key={`${idPrefix}-${index}`}
					ref={(el) => {
						refs.current[index] = el;
					}}
					id={`${idPrefix}-${index}`}
					type="text"
					inputMode="numeric"
					autoComplete={index === 0 ? 'one-time-code' : 'off'}
					maxLength={length}
					value={digit}
					disabled={disabled}
					aria-label={`Digit ${index + 1} of ${length}`}
					onChange={(e) => handleChange(index, e.target.value)}
					onKeyDown={(e) => handleKeyDown(index, e)}
					onFocus={(e) => e.target.select()}
					className={cn(
						'border-line bg-surface text-fg focus:border-primary h-12 w-10 rounded-md border text-center text-lg font-semibold tabular-nums focus:outline-none',
						'focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
						error && 'border-danger',
						disabled && 'opacity-60'
					)}
				/>
			))}
		</div>
	);
}
