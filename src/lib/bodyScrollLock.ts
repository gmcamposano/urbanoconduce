import type { Attachment } from 'svelte/attachments';

let activeLocks = 0;

let originalBodyStyles:
	| {
			body: HTMLElement;
			overflow: string;
			paddingRight: string;
	  }
	| undefined;

export function lockBodyScroll(): () => void {
	if (typeof document === 'undefined' || typeof window === 'undefined') {
		return () => {};
	}

	if (activeLocks === 0) {
		const body = document.body;
		const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
		const computedPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

		originalBodyStyles = {
			body,
			overflow: body.style.overflow,
			paddingRight: body.style.paddingRight
		};

		body.style.overflow = 'hidden';
		if (scrollbarWidth > 0) {
			body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
		}
	}

	activeLocks += 1;
	let released = false;

	return () => {
		if (released) return;
		released = true;
		activeLocks -= 1;

		if (activeLocks === 0 && originalBodyStyles) {
			originalBodyStyles.body.style.overflow = originalBodyStyles.overflow;
			originalBodyStyles.body.style.paddingRight = originalBodyStyles.paddingRight;
			originalBodyStyles = undefined;
		}
	};
}

export const bodyScrollLock: Attachment<HTMLElement> = () => lockBodyScroll();
