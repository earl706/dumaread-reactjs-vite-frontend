import { useCallback, useEffect, useRef, useState } from 'react';

/** px of movement before we lock to horizontal drag (vs tap / vertical). */
const SLOP_PX = 12;
/** Commit when dragged this fraction of the viewport width. */
const COMMIT_RATIO = 0.22;
/** Or when release velocity exceeds this (px/ms) in the turn direction. */
const COMMIT_VELOCITY = 0.55;
/** Settle / commit animation. */
const SETTLE_MS = 320;
/** Frames to wait after navigate before snapping sheet back (avoids flash). */
const RESET_FRAMES = 2;
/** Ignore opposite-axis noise once horizontal drag is locked. */
const AXIS_RATIO = 1.15;
/** Cooldown between trackpad-wheel page turns. */
const WHEEL_COOLDOWN_MS = 450;
/** Minimum |deltaX| on wheel to count as a page turn. */
const WHEEL_DELTA = 28;

function afterFrames(n, fn) {
	let left = n;
	const step = () => {
		left -= 1;
		if (left <= 0) fn();
		else requestAnimationFrame(step);
	};
	requestAnimationFrame(step);
}

/**
 * Interactive horizontal swipe/drag to turn reader pages (finger + mouse drag).
 * Tap (no drag) invokes onTap — used for immersive chrome reveal.
 * peekDir: 1 = next page underlay, -1 = previous, 0 = none.
 *
 * Commit order (no flash): keep sheet off-screen → navigate → wait frames →
 * snap offset to 0 → onCommitted (arrive). onCommitHold(dir) lets the parent
 * freeze the peek underlay until the new page is painted.
 */
export function useReaderSwipe({
	enabled = true,
	canPrev,
	canNext,
	onPrev,
	onNext,
	onTap,
	onCommitHold,
	onCommitted
}) {
	const [offsetX, setOffsetX] = useState(0);
	const [dragging, setDragging] = useState(false);
	const [settling, setSettling] = useState(false);

	const offsetRef = useRef(0);
	const draggingRef = useRef(false);
	const settlingRef = useRef(false);
	const axisRef = useRef(null); // null | 'h' | 'v'
	const pointerIdRef = useRef(null);
	const startRef = useRef({ x: 0, y: 0, t: 0 });
	const lastRef = useRef({ x: 0, t: 0 });
	const velocityRef = useRef(0);
	const widthRef = useRef(320);
	const surfaceRef = useRef(null);
	const canPrevRef = useRef(canPrev);
	const canNextRef = useRef(canNext);
	const onPrevRef = useRef(onPrev);
	const onNextRef = useRef(onNext);
	const onTapRef = useRef(onTap);
	const onCommitHoldRef = useRef(onCommitHold);
	const onCommittedRef = useRef(onCommitted);
	const enabledRef = useRef(enabled);
	const wheelLockRef = useRef(0);
	const settleTimerRef = useRef(null);

	canPrevRef.current = canPrev;
	canNextRef.current = canNext;
	onPrevRef.current = onPrev;
	onNextRef.current = onNext;
	onTapRef.current = onTap;
	onCommitHoldRef.current = onCommitHold;
	onCommittedRef.current = onCommitted;
	enabledRef.current = enabled;

	const setOffset = useCallback((x) => {
		offsetRef.current = x;
		setOffsetX(x);
	}, []);

	const resist = useCallback((dx) => {
		if (dx < 0 && !canNextRef.current) return dx * 0.28;
		if (dx > 0 && !canPrevRef.current) return dx * 0.28;
		return dx;
	}, []);

	const finishSettle = useCallback(
		(committedDir) => {
			if (committedDir === 0) {
				settlingRef.current = false;
				setSettling(false);
				setOffset(0);
				return;
			}

			// Freeze peek + navigate while the sheet is still off-screen.
			onCommitHoldRef.current?.(committedDir);
			if (committedDir > 0) onNextRef.current?.();
			else onPrevRef.current?.();

			afterFrames(RESET_FRAMES, () => {
				settlingRef.current = false;
				setSettling(false);
				setOffset(0);
				onCommittedRef.current?.(committedDir);
			});
		},
		[setOffset]
	);

	const settleTo = useCallback(
		(targetX, committedDir) => {
			if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);
			settlingRef.current = true;
			setSettling(true);
			draggingRef.current = false;
			setDragging(false);
			setOffset(targetX);
			settleTimerRef.current = window.setTimeout(() => {
				settleTimerRef.current = null;
				finishSettle(committedDir);
			}, SETTLE_MS);
		},
		[finishSettle, setOffset]
	);

	const endGesture = useCallback(() => {
		if (pointerIdRef.current == null) return;
		pointerIdRef.current = null;

		const wasDragging = draggingRef.current;
		const axis = axisRef.current;
		axisRef.current = null;

		if (!wasDragging || axis !== 'h') {
			draggingRef.current = false;
			setDragging(false);
			setOffset(0);
			if (axis !== 'v') onTapRef.current?.();
			return;
		}

		const width = Math.max(160, widthRef.current);
		const dx = offsetRef.current;
		const v = velocityRef.current;
		const dragNext = dx <= -width * COMMIT_RATIO;
		const dragPrev = dx >= width * COMMIT_RATIO;
		const flickNext = v <= -COMMIT_VELOCITY;
		const flickPrev = v >= COMMIT_VELOCITY;

		let dir = 0;
		if ((dragNext || flickNext) && canNextRef.current) dir = 1;
		else if ((dragPrev || flickPrev) && canPrevRef.current) dir = -1;

		if (dir === 0) {
			settleTo(0, 0);
			return;
		}
		settleTo(dir > 0 ? -width : width, dir);
	}, [setOffset, settleTo]);

	const onPointerDown = useCallback((e) => {
		if (!enabledRef.current || settlingRef.current) return;
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		pointerIdRef.current = e.pointerId;
		axisRef.current = null;
		draggingRef.current = false;
		velocityRef.current = 0;
		const now = performance.now();
		startRef.current = { x: e.clientX, y: e.clientY, t: now };
		lastRef.current = { x: e.clientX, t: now };
		widthRef.current = surfaceRef.current?.clientWidth || window.innerWidth || 320;
		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {
			/* ignore */
		}
	}, []);

	const onPointerMove = useCallback(
		(e) => {
			if (pointerIdRef.current !== e.pointerId || settlingRef.current) return;
			const { x: x0, y: y0 } = startRef.current;
			const dx = e.clientX - x0;
			const dy = e.clientY - y0;
			const now = performance.now();
			const dt = Math.max(1, now - lastRef.current.t);
			velocityRef.current = (e.clientX - lastRef.current.x) / dt;
			lastRef.current = { x: e.clientX, t: now };

			if (!axisRef.current) {
				const adx = Math.abs(dx);
				const ady = Math.abs(dy);
				if (adx < SLOP_PX && ady < SLOP_PX) return;
				if (adx >= ady * AXIS_RATIO) {
					axisRef.current = 'h';
					draggingRef.current = true;
					setDragging(true);
				} else if (ady >= adx * AXIS_RATIO) {
					axisRef.current = 'v';
					return;
				} else {
					return;
				}
			}
			if (axisRef.current !== 'h') return;

			e.preventDefault();
			setOffset(resist(dx));
		},
		[resist, setOffset]
	);

	const onPointerUp = useCallback(
		(e) => {
			if (pointerIdRef.current !== e.pointerId) return;
			try {
				e.currentTarget.releasePointerCapture(e.pointerId);
			} catch {
				/* ignore */
			}
			endGesture();
		},
		[endGesture]
	);

	const onPointerCancel = useCallback(
		(e) => {
			if (pointerIdRef.current !== e.pointerId) return;
			pointerIdRef.current = null;
			axisRef.current = null;
			draggingRef.current = false;
			setDragging(false);
			if (!settlingRef.current) settleTo(0, 0);
		},
		[settleTo]
	);

	const onLostPointerCapture = useCallback(() => {
		if (pointerIdRef.current == null || settlingRef.current) return;
		pointerIdRef.current = null;
		axisRef.current = null;
		if (draggingRef.current) endGesture();
	}, [endGesture]);

	useEffect(() => {
		const el = surfaceRef.current;
		if (!el || !enabled) return undefined;
		const onWheel = (e) => {
			if (settlingRef.current || draggingRef.current) return;
			if (Math.abs(e.deltaX) < WHEEL_DELTA || Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
				return;
			}
			const now = performance.now();
			if (now < wheelLockRef.current) return;
			e.preventDefault();
			wheelLockRef.current = now + WHEEL_COOLDOWN_MS;
			const dir = e.deltaX > 0 ? 1 : -1;
			if (dir > 0 && !canNextRef.current) return;
			if (dir < 0 && !canPrevRef.current) return;
			onCommitHoldRef.current?.(dir);
			if (dir > 0) onNextRef.current?.();
			else onPrevRef.current?.();
			onCommittedRef.current?.(dir);
		};
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	}, [enabled]);

	useEffect(
		() => () => {
			if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);
		},
		[]
	);

	const width = Math.max(160, widthRef.current);
	const peekDir = offsetX < -2 ? 1 : offsetX > 2 ? -1 : 0;
	const sheetActive = dragging || settling;
	const dragProgress = Math.min(1, Math.abs(offsetX) / (width * 0.45));

	const contentStyle = {
		transform: `translate3d(${offsetX}px, 0, 0)`,
		transition: settling ? `transform ${SETTLE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` : 'none',
		willChange: sheetActive ? 'transform' : undefined
	};

	const surfaceProps = {
		ref: surfaceRef,
		onPointerDown,
		onPointerMove,
		onPointerUp,
		onPointerCancel,
		onLostPointerCapture,
		style: { touchAction: 'pan-y' }
	};

	const isGestureActive = useCallback(() => draggingRef.current || settlingRef.current, []);

	return {
		contentStyle,
		surfaceProps,
		dragging,
		settling,
		sheetActive,
		peekDir,
		offsetX,
		dragProgress,
		isGestureActive
	};
}
