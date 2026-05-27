<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link';
		size?: 'default' | 'sm' | 'lg' | 'icon';
		children?: Snippet;
	}

	let {
		variant = 'default',
		size = 'default',
		class: className = '',
		children,
		type = 'button',
		...rest
	}: Props = $props();

	const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] cursor-pointer';

	const variants = {
		default: 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 border border-indigo-500/20',
		secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700/80 border border-zinc-700/50',
		outline: 'border border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white bg-transparent hover:border-zinc-700',
		destructive: 'bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-600/10 hover:shadow-rose-600/25 border border-rose-500/20',
		ghost: 'text-zinc-400 hover:bg-zinc-900 hover:text-white bg-transparent',
		link: 'text-indigo-400 hover:underline underline-offset-4 bg-transparent p-0 active:scale-100'
	};

	const sizes = {
		default: 'h-10 px-4 py-2',
		sm: 'h-8 rounded-md px-3 text-xs',
		lg: 'h-12 rounded-lg px-8 text-base',
		icon: 'h-10 w-10'
	};
</script>

<button
	{type}
	class="{baseStyles} {variants[variant]} {sizes[size]} {className}"
	{...rest}
>
	{#if children}
		{@render children()}
	{/if}
</button>
