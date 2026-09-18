<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		children?: Snippet;
	}

	let { class: className = '', children, ...rest }: Props = $props();
</script>

<div class="flex flex-col space-y-1.5 border-b border-[#ededed] p-6 {className}" {...rest}>
	{#if children}
		{@render children()}
	{/if}
</div>
