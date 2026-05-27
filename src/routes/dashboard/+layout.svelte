<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { LayoutDashboard, Users, ShieldAlert, LogOut, Menu, X, FileText, User } from '@lucide/svelte';

	let { data, children } = $props();

	let mobileMenuOpen = $state(false);

	const profile = $derived(data.profile);
	const activePath = $derived(page.url.pathname);

	function isActive(path: string) {
		if (path === '/dashboard') {
			return activePath === '/dashboard' || activePath.startsWith('/dashboard/invoices/');
		}

		return activePath === path;
	}
</script>

<div class="flex-1 flex flex-col md:flex-row min-h-screen bg-[#fafafa] text-[#171717]">
	<header class="md:hidden flex items-center justify-between px-6 py-4 bg-white border-b border-[#dfdfdf] no-print">
		<a href={resolve('/dashboard')} class="flex items-center gap-2">
			<div class="bg-[#3ecf8e] p-1.5 rounded-[6px] border border-[#24b47e]">
				<FileText class="h-5 w-5 text-[#171717]" />
			</div>
			<span class="font-medium text-md tracking-tight text-[#171717]">Factura<span class="text-[#3ecf8e]">Flow</span></span>
		</a>
		<button class="p-1 text-[#707070] hover:text-[#171717] cursor-pointer" onclick={() => (mobileMenuOpen = !mobileMenuOpen)}>
			{#if mobileMenuOpen}
				<X class="h-6 w-6" />
			{:else}
				<Menu class="h-6 w-6" />
			{/if}
		</button>
	</header>

	<aside class="w-full md:w-64 bg-white border-r border-[#dfdfdf] flex flex-col justify-between no-print {mobileMenuOpen ? 'block' : 'hidden md:flex'} relative z-30">
		<div class="flex flex-col">
			<div class="hidden md:flex items-center gap-2.5 px-6 py-8 border-b border-[#ededed]">
				<div class="bg-[#3ecf8e] p-2 rounded-[6px] border border-[#24b47e] shadow-sm">
					<FileText class="h-6 w-6 text-[#171717]" />
				</div>
				<span class="font-medium text-lg tracking-tight text-[#171717]">Factura<span class="text-[#3ecf8e]">Flow</span></span>
			</div>

			<nav class="p-4 space-y-1">
				<a href={resolve('/dashboard')} class="flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-sm font-medium transition-colors duration-200 {isActive('/dashboard') ? 'bg-[#3ecf8e] text-[#171717] shadow-sm shadow-black/5' : 'text-[#707070] hover:text-[#171717] hover:bg-[#fafafa]'}" onclick={() => (mobileMenuOpen = false)}>
					<LayoutDashboard class="h-4.5 w-4.5" />
					Facturas
				</a>

				<a href={resolve('/dashboard/clients')} class="flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-sm font-medium transition-colors duration-200 {isActive('/dashboard/clients') ? 'bg-[#3ecf8e] text-[#171717] shadow-sm shadow-black/5' : 'text-[#707070] hover:text-[#171717] hover:bg-[#fafafa]'}" onclick={() => (mobileMenuOpen = false)}>
					<Users class="h-4.5 w-4.5" />
					Clientes
				</a>

				{#if profile?.role === 'admin'}
					<a href={resolve('/dashboard/admin')} class="flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-sm font-medium transition-colors duration-200 {isActive('/dashboard/admin') ? 'bg-[#3ecf8e] text-[#171717] shadow-sm shadow-black/5' : 'text-[#707070] hover:text-[#171717] hover:bg-[#fafafa]'}" onclick={() => (mobileMenuOpen = false)}>
						<ShieldAlert class="h-4.5 w-4.5" />
						Administración
					</a>
				{/if}
			</nav>
		</div>

		<div class="p-4 border-t border-[#ededed] flex flex-col gap-4 bg-[#fafafa]">
			<div class="flex items-center gap-3">
				<div class="h-10 w-10 rounded-[6px] bg-white border border-[#dfdfdf] flex items-center justify-center flex-shrink-0">
					<User class="h-5 w-5 text-[#707070]" />
				</div>
				<div class="flex-1 min-w-0">
					<p class="text-sm font-medium text-[#171717] truncate">{profile?.name || 'Usuario'}</p>
					<div class="flex items-center gap-1.5 mt-0.5">
						{#if profile?.role === 'admin'}
							<Badge variant="default" class="text-[9px] px-1.5 py-0">ADMIN</Badge>
						{:else if profile?.role === 'editor'}
							<Badge variant="secondary" class="text-[9px] px-1.5 py-0">EDITOR</Badge>
						{:else}
							<Badge variant="outline" class="text-[9px] px-1.5 py-0">LECTOR</Badge>
						{/if}
						<span class="text-[10px] text-[#9a9a9a] truncate max-w-[100px]">{profile?.email}</span>
					</div>
				</div>
			</div>

			<form action="/login?/logout" method="POST" class="w-full">
				<button type="submit" class="w-full flex items-center justify-center gap-2 px-3 py-2 border border-[#dfdfdf] hover:border-[#c7c7c7] bg-white hover:bg-[#fafafa] text-[#171717] rounded-[6px] text-xs font-medium transition-colors duration-200 cursor-pointer">
					<LogOut class="h-3.5 w-3.5" />
					Cerrar sesión
				</button>
			</form>
		</div>
	</aside>

	<main class="flex-1 bg-[#fafafa] p-6 md:p-10 flex flex-col">
		{@render children()}
	</main>
</div>
