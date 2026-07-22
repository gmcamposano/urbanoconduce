<script lang="ts">
	import type { Snippet } from 'svelte';

	type Placement = 'top' | 'bottom' | 'left' | 'right';

	interface Props {
		content?: string;
		placement?: Placement;
		triggerClass?: string;
		children: Snippet;
	}

	let { content, placement = 'top', triggerClass = 'inline-flex', children }: Props = $props();

	let visible = $state(false);
	let triggerEl: HTMLElement | null = null;
	let coords = $state({ top: 0, left: 0, arrowTop: 0, arrowLeft: 0 });
	const uid = $props.id();

	const GAP = 8;

	function compute() {
		if (!triggerEl || !content) return;
		const r = triggerEl.getBoundingClientRect();
		const TT_W = 200;
		const TT_H = 32;
		let top: number;
		let left: number;
		let arrowTop: number;
		let arrowLeft: number;

		if (placement === 'top') {
			top = r.top - TT_H - GAP;
			left = r.left + r.width / 2 - TT_W / 2;
			arrowTop = TT_H - 4;
			arrowLeft = TT_W / 2 - 4;
		} else if (placement === 'bottom') {
			top = r.bottom + GAP;
			left = r.left + r.width / 2 - TT_W / 2;
			arrowTop = -4;
			arrowLeft = TT_W / 2 - 4;
		} else if (placement === 'left') {
			top = r.top + r.height / 2 - TT_H / 2;
			left = r.left - TT_W - GAP;
			arrowTop = TT_H / 2 - 4;
			arrowLeft = TT_W - 4;
		} else {
			top = r.top + r.height / 2 - TT_H / 2;
			left = r.right + GAP;
			arrowTop = TT_H / 2 - 4;
			arrowLeft = -4;
		}

		const pad = 4;
		left = Math.max(pad, Math.min(left, window.innerWidth - TT_W - pad));
		top = Math.max(pad, Math.min(top, window.innerHeight - TT_H - pad));

		coords = { top, left, arrowTop, arrowLeft };
	}

	function show() {
		if (!content) return;
		visible = true;
		queueMicrotask(compute);
	}

	function hide() {
		visible = false;
	}

	function tooltipTrigger(node: HTMLElement) {
		triggerEl = node;
		const enter = () => show();
		const leave = () => hide();
		node.addEventListener('mouseenter', enter);
		node.addEventListener('mouseleave', leave);
		node.addEventListener('focusin', enter);
		node.addEventListener('focusout', leave);
		return () => {
			node.removeEventListener('mouseenter', enter);
			node.removeEventListener('mouseleave', leave);
			node.removeEventListener('focusin', enter);
			node.removeEventListener('focusout', leave);
		};
	}
</script>

<svelte:window onscroll={visible ? compute : undefined} onresize={visible ? compute : undefined} />

<span class={triggerClass} {@attach tooltipTrigger}>
	{@render children()}
</span>

{#if visible && content}
	<div
		id={uid}
		role="tooltip"
		class="fixed z-[300] inline-block max-w-[240px] rounded-[6px] bg-[#1c1c1c] px-3 py-2 text-center text-xs font-normal text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
		style={`top: ${coords.top}px; left: ${coords.left}px;`}
	>
		{content}
		<span
			class="absolute h-2 w-2 rotate-45 bg-[#1c1c1c]"
			style={`top: ${coords.arrowTop}px; left: ${coords.arrowLeft}px;`}
		></span>
	</div>
{/if}
