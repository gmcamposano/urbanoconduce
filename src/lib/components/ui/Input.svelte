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
		<label for={id} class="text-[11px] font-medium uppercase tracking-[0.12em] text-[#707070]">
			{label}
		</label>
	{/if}
	<input
		{id}
		{type}
		bind:value
		class="flex h-9 w-full rounded-[6px] border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] placeholder:text-[#9a9a9a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:border-[#24b47e] disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-200 {error ? 'border-[#e2005a]/50 focus-visible:ring-[#e2005a]/20' : ''} {className}"
		{...rest}
	/>
	{#if error}
		<p class="text-xs text-[#e2005a] font-medium mt-0.5">{error}</p>
	{/if}
</div>
