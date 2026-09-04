<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { X } from '@lucide/svelte';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		open?: boolean;
		title?: string;
		description?: string;
		children?: Snippet;
		footer?: Snippet;
		onClose?: () => void;
	}

	let {
		open = false,
		title,
		description,
		children,
		footer,
		onClose,
		class: className = '',
		...rest
	}: Props = $props();

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose?.();
		}
	}

	$effect(() => {
		if (!open) return;
		const prevOverflow = document.body.style.overflow;
		const prevPaddingRight = document.body.style.paddingRight;
		const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
		document.body.style.overflow = 'hidden';
		if (scrollbarWidth > 0) {
			document.body.style.paddingRight = `${scrollbarWidth}px`;
		}
		return () => {
			document.body.style.overflow = prevOverflow;
			document.body.style.paddingRight = prevPaddingRight;
		};
	});
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
		role="presentation"
		onclick={() => onClose?.()}
	>
		<div
			class="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-[#dfdfdf] bg-white text-[#171717] shadow-[0_16px_48px_rgba(0,0,0,0.12)] {className}"
			role="dialog"
			aria-modal="true"
			onclick={(event) => event.stopPropagation()}
			{...rest}
		>
			<div class="flex shrink-0 items-start justify-between gap-4 border-b border-[#ededed] p-5">
				<div class="space-y-1">
					{#if title}
						<h2 class="text-lg font-medium tracking-tight text-[#171717]">{title}</h2>
					{/if}
					{#if description}
						<p class="text-sm text-[#707070]">{description}</p>
					{/if}
				</div>
				{#if onClose}
					<button
						type="button"
						class="rounded-[6px] p-1 text-[#707070] hover:bg-[#fafafa] hover:text-[#171717]"
						onclick={onClose}
						aria-label="Close dialog"
					>
						<X class="h-4 w-4" />
					</button>
				{/if}
			</div>

			<div class="flex-1 overflow-y-auto p-5">
				{#if children}
					{@render children()}
				{/if}
			</div>

			{#if footer}
				<div class="flex shrink-0 items-center justify-end gap-3 border-t border-[#ededed] p-5">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
