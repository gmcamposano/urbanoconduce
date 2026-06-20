<script lang="ts">
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/ui/Badge.svelte';
	import {
		LayoutDashboard,
		Users,
		ShieldAlert,
		LogOut,
		FileText,
		User,
		Package,
		Palette,
		Boxes,
		Calculator
	} from '@lucide/svelte';

	let {
		profile,
		activePath,
		onNavigate
	}: {
		profile: { name?: string; email?: string; role?: string } | null;
		activePath: string;
		onNavigate?: () => void;
	} = $props();

	function getNavClass(path: string) {
		const active = isActive(path);
		return active
			? 'bg-[#3ecf8e] text-[#171717] shadow-sm shadow-black/5'
			: 'text-[#707070] hover:bg-[#fafafa] hover:text-[#171717]';
	}

	function isActive(path: string) {
		if (path === '/dashboard/proforma') {
			return activePath === '/dashboard/proforma' || activePath.startsWith('/dashboard/proforma/');
		}
		if (path === '/dashboard/invoices') {
			return activePath === '/dashboard/invoices' || activePath.startsWith('/dashboard/invoices/');
		}
		if (path === '/dashboard/accounting') {
			return activePath === '/dashboard/accounting' || activePath.startsWith('/dashboard/accounting/');
		}
		return activePath === path;
	}
</script>

<aside
	class="no-print sticky top-0 hidden h-screen flex-col justify-between border-r border-[#dfdfdf] bg-white md:flex md:w-64"
>
	<div class="flex flex-col">
		<a
			href={resolve('/dashboard/proforma')}
			class="hidden items-center gap-2.5 border-b border-[#ededed] px-6 py-8 md:flex md:cursor-pointer"
		>
			<div class="rounded-md border border-[#24b47e] bg-[#3ecf8e] p-2 shadow-sm">
				<FileText class="h-6 w-6 text-[#171717]" />
			</div>
			<span class="text-lg font-medium tracking-tight text-[#171717]"
				>magikal<span class="text-[#3ecf8e]">Invoice</span>
			</span>
		</a>

		<nav class="space-y-1 p-4">
			{#if profile?.role !== 'editor'}
				<a
					href={resolve('/dashboard/invoices')}
					class="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-200 {getNavClass(
						'/dashboard/invoices'
					)}"
					onclick={onNavigate}
				>
					<FileText class="h-4.5 w-4.5" />
					Facturas
				</a>
			{/if}

			<a
				href={resolve('/dashboard/proforma')}
				class="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-200 {getNavClass(
					'/dashboard/proforma'
				)}"
				onclick={onNavigate}
			>
				<LayoutDashboard class="h-4.5 w-4.5" />
				Proformas
			</a>

		{#if profile?.role === 'admin'}
			<a
				href={resolve('/dashboard/accounting')}
				class="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-200 {getNavClass(
					'/dashboard/accounting'
				)}"
				onclick={onNavigate}
			>
				<Calculator class="h-4.5 w-4.5" />
				Contabilidad
			</a>
		{/if}

			<a
				href={resolve('/dashboard/clients')}
				class="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-200 {getNavClass(
					'/dashboard/clients'
				)}"
				onclick={onNavigate}
			>
				<Users class="h-4.5 w-4.5" />
				Clientes
			</a>

			<a
				href={resolve('/dashboard/products')}
				class="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-200 {getNavClass(
					'/dashboard/products'
				)}"
				onclick={onNavigate}
			>
				<Package class="h-4.5 w-4.5" />
				Productos
			</a>

			<a
				href={resolve('/dashboard/colors')}
				class="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-200 {getNavClass(
					'/dashboard/colors'
				)}"
				onclick={onNavigate}
			>
				<Palette class="h-4.5 w-4.5" />
				Colores
			</a>

			<a
				href={resolve('/dashboard/models')}
				class="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-200 {getNavClass(
					'/dashboard/models'
				)}"
				onclick={onNavigate}
			>
				<Boxes class="h-4.5 w-4.5" />
				Modelos
			</a>

			{#if profile?.role === 'admin'}
				<a
					href={resolve('/dashboard/admin')}
					class="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-200 {getNavClass(
						'/dashboard/admin'
					)}"
					onclick={onNavigate}
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
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#dfdfdf] bg-white"
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
					<span class="max-w-25 truncate text-[10px] text-[#9a9a9a]">{profile?.email}</span>
				</div>
			</div>
		</div>

		<form action="/login?/logout" method="POST" class="w-full">
			<button
				type="submit"
				class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-xs font-medium text-[#171717] transition-colors duration-200 hover:border-[#c7c7c7] hover:bg-[#fafafa]"
			>
				<LogOut class="h-3.5 w-3.5" />
				Cerrar sesión
			</button>
		</form>
	</div>
</aside>
