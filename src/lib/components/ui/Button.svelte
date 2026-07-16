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

	const baseStyles =
		'inline-flex items-center justify-center gap-2 rounded-[6px] text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-50 disabled:pointer-events-none active:translate-y-px cursor-pointer';

	const variants = {
		default:
			'bg-[#3ecf8e] text-[#171717] hover:bg-[#24b47e] shadow-sm shadow-black/5 border border-transparent',
		secondary: 'bg-[#fafafa] text-[#171717] hover:bg-[#f3f3f3] border border-[#dfdfdf]',
		outline: 'border border-[#c7c7c7] text-[#171717] hover:bg-[#fafafa] bg-white',
		destructive: 'bg-[#171717] text-white hover:bg-[#212121] border border-[#171717]',
		ghost: 'text-[#171717] hover:bg-[#fafafa] bg-transparent',
		link: 'text-[#171717] hover:underline underline-offset-4 bg-transparent p-0 active:translate-y-0 shadow-none border-0'
	};

	const sizes = {
		default: 'h-9 px-4 py-2',
		sm: 'h-8 px-3 text-xs',
		lg: 'h-11 px-5 text-base',
		icon: 'h-9 w-9 p-0'
	};
</script>

<button {type} class="{baseStyles} {variants[variant]} {sizes[size]} {className}" {...rest}>
	{#if children}
		{@render children()}
	{/if}
</button>
