<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		children?: Snippet;
	}

	let {
		class: className = '',
		children,
		...rest
	}: Props = $props();
</script>

<div
	class="rounded-xl border border-zinc-800/80 bg-zinc-950/70 text-zinc-100 shadow-xl shadow-black/20 backdrop-blur-md overflow-hidden {className}"
	{...rest}
>
	{#if children}
		{@render children()}
	{/if}
</div>
