<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		label?: string;
		error?: string;
		prefix?: string;
	}

	let {
		value = $bindable(''),
		class: className = '',
		label,
		error,
		prefix,
		id = 'input-' + Math.random().toString(36).substring(2, 9),
		type = 'text',
		...rest
	}: Props = $props();
</script>

<div class="flex w-full flex-col gap-1.5">
	{#if label}
		<label for={id} class="text-[11px] font-medium tracking-[0.12em] text-[#707070] uppercase">
			{label}
		</label>
	{/if}
	<div class="relative">
		{#if prefix}
			<span
				class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-[#707070]"
			>
				{prefix}
			</span>
		{/if}
		<input
			{id}
			{type}
			bind:value
			class="flex h-9 w-full rounded-[6px] border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] transition-colors duration-200 placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 {prefix
				? 'pl-14'
				: ''} {error ? 'border-[#e2005a]/50 focus-visible:ring-[#e2005a]/20' : ''} {className}"
			{...rest}
		/>
	</div>
	{#if error}
		<p class="mt-0.5 text-xs font-medium text-[#e2005a]">{error}</p>
	{/if}
</div>
