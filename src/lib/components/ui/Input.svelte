<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		label?: string;
		error?: string;
	}

	let {
		value = $bindable(''),
		class: className = '',
		label,
		error,
		id = 'input-' + Math.random().toString(36).substring(2, 9),
		type = 'text',
		...rest
	}: Props = $props();
</script>

<div class="flex flex-col gap-1.5 w-full">
	{#if label}
		<label for={id} class="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
			{label}
		</label>
	{/if}
	<input
		{id}
		{type}
		bind:value
		class="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 {error ? 'border-rose-500/60 focus-visible:ring-rose-500/30' : ''} {className}"
		{...rest}
	/>
	{#if error}
		<p class="text-xs text-rose-400 font-medium mt-0.5">{error}</p>
	{/if}
</div>
