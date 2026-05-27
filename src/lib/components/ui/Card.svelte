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
	class="rounded-lg border border-[#dfdfdf] bg-white text-[#171717] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden {className}"
	{...rest}
>
	{#if children}
		{@render children()}
	{/if}
</div>
