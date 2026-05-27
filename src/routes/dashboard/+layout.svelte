<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/ui/Badge.svelte';
	import {
		LayoutDashboard,
		Users,
		ShieldAlert,
		LogOut,
		Menu,
		X,
		FileText,
		User,
		Package,
		Palette
	} from '@lucide/svelte';

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

<div class="flex min-h-screen flex-1 flex-col bg-[#fafafa] text-[#171717] md:flex-row">
	<header
		class="no-print flex items-center justify-between border-b border-[#dfdfdf] bg-white px-6 py-4 md:hidden"
	>
		<a href={resolve('/dashboard')} class="flex items-center gap-2">
			<div class="rounded-[6px] border border-[#24b47e] bg-[#3ecf8e] p-1.5">
				<FileText class="h-5 w-5 text-[#171717]" />
			</div>
			<span class="text-md font-medium tracking-tight text-[#171717]"
				>magikal<span class="text-[#3ecf8e]">Conduce</span></span
			>
		</a>
		<button
			class="cursor-pointer p-1 text-[#707070] hover:text-[#171717]"
			onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
		>
			{#if mobileMenuOpen}
				<X class="h-6 w-6" />
			{:else}
				<Menu class="h-6 w-6" />
			{/if}
		</button>
	</header>

	<aside
		class="no-print flex w-full flex-col justify-between border-r border-[#dfdfdf] bg-white md:w-64 {mobileMenuOpen
			? 'block'
			: 'hidden md:flex'} relative z-30"
	>
		<div class="flex flex-col">
			<div class="hidden items-center gap-2.5 border-b border-[#ededed] px-6 py-8 md:flex">
				<div class="rounded-[6px] border border-[#24b47e] bg-[#3ecf8e] p-2 shadow-sm">
					<FileText class="h-6 w-6 text-[#171717]" />
				</div>
				<span class="text-lg font-medium tracking-tight text-[#171717]"
					>magikal<span class="text-[#3ecf8e]">Conduce</span></span
				>
			</div>

			<nav class="space-y-1 p-4">
				<a
					href={resolve('/dashboard')}
					class="flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-sm font-medium transition-colors duration-200 {isActive(
						'/dashboard'
					)
						? 'bg-[#3ecf8e] text-[#171717] shadow-sm shadow-black/5'
						: 'text-[#707070] hover:bg-[#fafafa] hover:text-[#171717]'}"
					onclick={() => (mobileMenuOpen = false)}
				>
					<LayoutDashboard class="h-4.5 w-4.5" />
					Facturas
				</a>

				<a
					href={resolve('/dashboard/clients')}
					class="flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-sm font-medium transition-colors duration-200 {isActive(
						'/dashboard/clients'
					)
						? 'bg-[#3ecf8e] text-[#171717] shadow-sm shadow-black/5'
						: 'text-[#707070] hover:bg-[#fafafa] hover:text-[#171717]'}"
					onclick={() => (mobileMenuOpen = false)}
				>
					<Users class="h-4.5 w-4.5" />
					Clientes
				</a>

				<a
					href={resolve('/dashboard/products')}
					class="flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-sm font-medium transition-colors duration-200 {isActive(
						'/dashboard/products'
					)
						? 'bg-[#3ecf8e] text-[#171717] shadow-sm shadow-black/5'
						: 'text-[#707070] hover:bg-[#fafafa] hover:text-[#171717]'}"
					onclick={() => (mobileMenuOpen = false)}
				>
					<Package class="h-4.5 w-4.5" />
					Productos
				</a>

				<a
					href={resolve('/dashboard/colors')}
					class="flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-sm font-medium transition-colors duration-200 {isActive(
						'/dashboard/colors'
					)
						? 'bg-[#3ecf8e] text-[#171717] shadow-sm shadow-black/5'
						: 'text-[#707070] hover:bg-[#fafafa] hover:text-[#171717]'}"
					onclick={() => (mobileMenuOpen = false)}
				>
					<Palette class="h-4.5 w-4.5" />
					Colores
				</a>

				{#if profile?.role === 'admin'}
					<a
						href={resolve('/dashboard/admin')}
						class="flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-sm font-medium transition-colors duration-200 {isActive(
							'/dashboard/admin'
						)
							? 'bg-[#3ecf8e] text-[#171717] shadow-sm shadow-black/5'
							: 'text-[#707070] hover:bg-[#fafafa] hover:text-[#171717]'}"
						onclick={() => (mobileMenuOpen = false)}
					>
						<ShieldAlert class="h-4.5 w-4.5" />
						Administración
					</a>
				{/if}
			</nav>
		</div>

		<div class="flex flex-col gap-4 border-t border-[#ededed] bg-[#fafafa] p-4">
			<div class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[6px] border border-[#dfdfdf] bg-white"
				>
					<User class="h-5 w-5 text-[#707070]" />
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium text-[#171717]">{profile?.name || 'Usuario'}</p>
					<div class="mt-0.5 flex items-center gap-1.5">
						{#if profile?.role === 'admin'}
							<Badge variant="default" class="px-1.5 py-0 text-[9px]">ADMIN</Badge>
						{:else if profile?.role === 'editor'}
							<Badge variant="secondary" class="px-1.5 py-0 text-[9px]">EDITOR</Badge>
						{:else}
							<Badge variant="outline" class="px-1.5 py-0 text-[9px]">LECTOR</Badge>
						{/if}
						<span class="max-w-[100px] truncate text-[10px] text-[#9a9a9a]">{profile?.email}</span>
					</div>
				</div>
			</div>

			<form action="/login?/logout" method="POST" class="w-full">
				<button
					type="submit"
					class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[6px] border border-[#dfdfdf] bg-white px-3 py-2 text-xs font-medium text-[#171717] transition-colors duration-200 hover:border-[#c7c7c7] hover:bg-[#fafafa]"
				>
					<LogOut class="h-3.5 w-3.5" />
					Cerrar sesión
				</button>
			</form>
		</div>
	</aside>

	<main class="flex flex-1 flex-col bg-[#fafafa] p-6 md:p-10">
		{@render children()}
	</main>
</div>
