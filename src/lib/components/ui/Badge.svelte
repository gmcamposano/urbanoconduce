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
		default: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-sm shadow-indigo-500/5',
		secondary: 'bg-zinc-800 text-zinc-300 border-zinc-700/50',
		outline: 'bg-transparent text-zinc-400 border-zinc-800',
		success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-sm shadow-emerald-500/5',
		warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-sm shadow-amber-500/5',
		danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-sm shadow-rose-500/5',
		info: 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sm shadow-sky-500/5'
	};
</script>

<span
	class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold select-none transition-colors {variants[variant]} {className}"
	{...rest}
>
	{#if children}
		{@render children()}
	{/if}
</span>
