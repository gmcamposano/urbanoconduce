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
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" role="presentation" onclick={() => onClose?.()}>
		<div
			class="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl {className}"
			role="dialog"
			aria-modal="true"
			onclick={(event) => event.stopPropagation()}
			{...rest}
		>
			<div class="flex items-start justify-between gap-4 border-b border-zinc-900/80 p-5">
				<div class="space-y-1">
					{#if title}
						<h2 class="text-lg font-bold tracking-tight">{title}</h2>
					{/if}
					{#if description}
						<p class="text-sm text-zinc-400">{description}</p>
					{/if}
				</div>
				{#if onClose}
					<button type="button" class="rounded-md p-1 text-zinc-500 hover:bg-zinc-900 hover:text-white" onclick={onClose} aria-label="Close dialog">
						<X class="h-4 w-4" />
					</button>
				{/if}
			</div>

			<div class="p-5">
				{#if children}
					{@render children()}
				{/if}
			</div>

			{#if footer}
				<div class="flex items-center justify-end gap-3 border-t border-zinc-900/80 p-5">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
