<script lang="ts">
	import { navigating } from '$app/state';

	// Show the bar only when navigating to a different route (not form submissions / hash changes).
	const isNavigating = $derived(
		!!navigating.to &&
			navigating.from?.url.pathname !== navigating.to.url.pathname
	);

	// Keep the bar mounted briefly after navigation ends so the "complete" animation can play.
	let visible = $state(false);
	let hideTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (isNavigating) {
			if (hideTimer) {
				clearTimeout(hideTimer);
				hideTimer = null;
			}
			visible = true;
		} else if (visible) {
			// Let the bar finish before unmounting.
			hideTimer = setTimeout(() => {
				visible = false;
				hideTimer = null;
			}, 220);
		}
	});
</script>

{#if visible}
	<div
		class="route-loading-bar"
		class:route-loading-bar--active={isNavigating}
		aria-hidden="true"
	></div>
{/if}

<style>
	.route-loading-bar {
		position: fixed;
		top: 0;
		left: 0;
		height: 2px;
		width: 100%;
		z-index: 9999;
		pointer-events: none;
		background: transparent;
		overflow: hidden;
	}

	/* Indeterminate shimmer while navigating. */
	.route-loading-bar::after {
		content: '';
		position: absolute;
		inset: 0;
		display: block;
		transform: translateX(-100%);
		background: linear-gradient(
			90deg,
			transparent 0%,
			#3ecf8e 20%,
			#24b47e 50%,
			#3ecf8e 80%,
			transparent 100%
		);
		opacity: 0;
		transition: opacity 120ms ease-out;
	}

	.route-loading-bar--active::after {
		opacity: 1;
		animation: route-loading-slide 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
	}

	/* Final "fill and fade" when navigation completes. */
	.route-loading-bar:not(.route-loading-bar--active)::after {
		opacity: 1;
		transform: translateX(0);
		transition:
			transform 200ms ease-out,
			opacity 200ms ease-out 20ms;
		animation: none;
	}

	@keyframes route-loading-slide {
		0% {
			transform: translateX(-100%);
		}
		50% {
			transform: translateX(-35%);
		}
		100% {
			transform: translateX(100%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.route-loading-bar--active::after {
			animation: none;
			transform: translateX(0);
			opacity: 0.85;
		}
	}
</style>
