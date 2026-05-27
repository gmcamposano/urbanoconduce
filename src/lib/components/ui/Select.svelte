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
			class="flex h-9 w-full rounded-[6px] border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:border-[#24b47e] disabled:cursor-not-allowed disabled:opacity-50 appearance-none transition-colors duration-200 cursor-pointer {error ? 'border-[#e2005a]/50 focus-visible:ring-[#e2005a]/20' : ''} {className}"
			{...rest}
		>
			{#if children}
				{@render children()}
			{/if}
		</select>
		<!-- Custom dropdown chevron arrow for premium feel -->
		<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[#9a9a9a]">
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</div>
	</div>
	{#if error}
		<p class="text-xs text-[#e2005a] font-medium mt-0.5">{error}</p>
	{/if}
</div>
