<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLHeadingElement> {
		children?: Snippet;
	}

	let { class: className = '', children, ...rest }: Props = $props();
</script>

<h3
	class="text-[22px] leading-none font-medium tracking-tight text-[#171717] {className}"
	{...rest}
>
	{#if children}
		{@render children()}
	{/if}
</h3>
