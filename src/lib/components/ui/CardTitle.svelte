<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLHeadingElement> {
		children?: Snippet;
	}

	let {
		class: className = '',
		children,
		...rest
	}: Props = $props();
</script>

<h3
	class="text-lg font-bold tracking-tight text-white leading-none {className}"
	{...rest}
>
	{#if children}
		{@render children()}
	{/if}
</h3>
