<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	interface Props extends HTMLSelectAttributes {
		label?: string;
		error?: string;
		children?: Snippet;
	}

	let {
		value = $bindable(''),
		class: className = '',
		label,
		error,
		children,
		id = 'select-' + Math.random().toString(36).substring(2, 9),
		...rest
	}: Props = $props();
</script>

<div class="flex flex-col gap-1.5 w-full">
	{#if label}
		<label for={id} class="text-[11px] font-medium uppercase tracking-[0.12em] text-[#707070]">
			{label}
		</label>
	{/if}
	<div class="relative w-full">
		<select
			{id}
			bind:value
			class="flex h-9 w-full cursor-pointer rounded-[6px] border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] transition-colors duration-200 focus-visible:border-[#24b47e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 disabled:cursor-not-allowed disabled:opacity-50 {error ? 'border-[#e2005a]/50 focus-visible:ring-[#e2005a]/20' : ''} {className}"
			{...rest}
		>
			{#if children}
				{@render children()}
			{/if}
		</select>
	</div>
	{#if error}
		<p class="text-xs text-[#e2005a] font-medium mt-0.5">{error}</p>
	{/if}
</div>
