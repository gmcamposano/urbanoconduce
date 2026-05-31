<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLSpanElement> {
		variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'danger' | 'info';
		children?: Snippet;
	}

	let {
		variant = 'default',
		class: className = '',
		children,
		...rest
	}: Props = $props();

	const variants = {
		default: 'bg-[#3ecf8e] text-[#171717] border-[#3ecf8e]/35',
		secondary: 'bg-[#fafafa] text-[#171717] border-[#dfdfdf]',
		outline: 'bg-white text-[#707070] border-[#dfdfdf]',
		success: 'bg-[#3ecf8e]/12 text-[#171717] border-[#3ecf8e]/35',
		warning: 'bg-[#fef9c3] text-[#171717] border-[#fde047]',
		danger: 'bg-[#e2005a]/10 text-[#e2005a] border-[#e2005a]/20',
		info: 'bg-[#ededed] text-[#171717] border-[#dfdfdf]'
	};
</script>

<span
	class="inline-flex items-center rounded border px-2.5 py-0.5 text-xs font-medium select-none transition-colors {variants[variant]} {className}"
	{...rest}
>
	{#if children}
		{@render children()}
	{/if}
</span>
