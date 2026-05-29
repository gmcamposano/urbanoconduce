<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import MobileMenu from '$lib/components/layout/MobileMenu.svelte';
	import { Menu, FileText } from '@lucide/svelte';

	let { data, children } = $props();

	let mobileMenuOpen = $state(false);

	const profile = $derived(data.profile);
	const activePath = $derived(page.url.pathname);

	$effect(() => {
		if (mobileMenuOpen) {
			document.body.style.overflow = 'hidden';
			document.body.style.height = '100vh';
		} else {
			document.body.style.overflow = '';
			document.body.style.height = '';
		}
	});
</script>

<div class="flex min-h-screen flex-1 flex-col bg-[#fafafa] text-[#171717] md:flex-row">
	<header
		class="no-print flex items-center justify-between border-b border-[#dfdfdf] bg-white px-6 py-4 md:hidden"
	>
		<a href={resolve('/dashboard')} class="flex items-center gap-2">
			<div class="rounded-md border border-[#24b47e] bg-[#3ecf8e] p-1.5">
				<FileText class="h-5 w-5 text-[#171717]" />
			</div>
			<span class="text-md font-medium tracking-tight text-[#171717]"
				>magikal<span class="text-[#3ecf8e]">Invoice</span></span
			>
		</a>
		<button
			class="cursor-pointer p-1 text-[#707070] hover:text-[#171717]"
			onclick={() => (mobileMenuOpen = true)}
			aria-label="Abrir menú"
		>
			<Menu class="h-6 w-6" />
		</button>
	</header>

	<Sidebar {profile} {activePath} />

	{#if mobileMenuOpen}
		<MobileMenu {profile} {activePath} onClose={() => (mobileMenuOpen = false)} />
	{/if}

	<main class="flex flex-1 flex-col bg-[#fafafa] p-6 md:p-10">
		{@render children()}
	</main>
</div>
