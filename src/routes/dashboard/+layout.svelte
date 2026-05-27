<script lang="ts">
	import { page } from '$app/state';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { 
		LayoutDashboard, 
		ShieldAlert, 
		LogOut, 
		Menu, 
		X, 
		FileText, 
		User 
	} from '@lucide/svelte';

	let { data, children } = $props();
	
	let mobileMenuOpen = $state(false);

	const profile = $derived(data.profile);
	const activePath = $derived(page.url.pathname);
	
	// Helper to determine if link is active
	function isActive(path: string) {
		if (path === '/dashboard') {
			return activePath === '/dashboard' || activePath.startsWith('/dashboard/invoices/');
		}
		return activePath === path;
	}
</script>

<div class="flex-1 flex flex-col md:flex-row min-h-screen">
	<!-- Mobile Header -->
	<header class="md:hidden flex items-center justify-between px-6 py-4 bg-zinc-950 border-b border-zinc-900 no-print">
		<a href="/dashboard" class="flex items-center gap-2">
			<div class="bg-indigo-600/10 p-1.5 rounded border border-indigo-500/20">
				<FileText class="h-5 w-5 text-indigo-400" />
			</div>
			<span class="font-extrabold text-md tracking-tight text-white">Invoice<span class="text-indigo-400">Flow</span></span>
		</a>
		<button 
			class="p-1 text-zinc-400 hover:text-white cursor-pointer"
			onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
		>
			{#if mobileMenuOpen}
				<X class="h-6 w-6" />
			{:else}
				<Menu class="h-6 w-6" />
			{/if}
		</button>
	</header>

	<!-- Sidebar Navigation -->
	<aside class="w-full md:w-64 bg-zinc-950/80 border-r border-zinc-900 flex flex-col justify-between no-print {mobileMenuOpen ? 'block' : 'hidden md:flex'} relative z-30">
		<div class="flex flex-col">
			<!-- Logo Section -->
			<div class="hidden md:flex items-center gap-2.5 px-6 py-8 border-b border-zinc-900/60">
				<div class="bg-indigo-600/10 p-2 rounded-lg border border-indigo-500/20">
					<FileText class="h-6 w-6 text-indigo-400" />
				</div>
				<span class="font-black text-lg tracking-tight text-white">Invoice<span class="text-indigo-400">Flow</span></span>
			</div>

			<!-- Navigation Links -->
			<nav class="p-4 space-y-1">
				<a 
					href="/dashboard" 
					class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 {isActive('/dashboard') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}"
					onclick={() => (mobileMenuOpen = false)}
				>
					<LayoutDashboard class="h-4.5 w-4.5" />
					Invoices Dashboard
				</a>

				<!-- Admin Access Page -->
				{#if profile?.role === 'admin'}
					<a 
						href="/dashboard/admin" 
						class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 {isActive('/dashboard/admin') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}"
						onclick={() => (mobileMenuOpen = false)}
					>
						<ShieldAlert class="h-4.5 w-4.5" />
						Admin Settings
					</a>
				{/if}
			</nav>
		</div>

		<!-- User Account Block -->
		<div class="p-4 border-t border-zinc-900/60 flex flex-col gap-4 bg-zinc-950">
			<div class="flex items-center gap-3">
				<div class="h-10 w-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
					<User class="h-5 w-5 text-indigo-400" />
				</div>
				<div class="flex-1 min-w-0">
					<p class="text-sm font-bold text-white truncate">{profile?.name || 'User'}</p>
					<div class="flex items-center gap-1.5 mt-0.5">
						<!-- Role Badges -->
						{#if profile?.role === 'admin'}
							<Badge variant="danger" class="text-[9px] px-1.5 py-0">ADMIN</Badge>
						{:else if profile?.role === 'editor'}
							<Badge variant="info" class="text-[9px] px-1.5 py-0">EDITOR</Badge>
						{:else}
							<Badge variant="secondary" class="text-[9px] px-1.5 py-0">VIEWER</Badge>
						{/if}
						<span class="text-[10px] text-zinc-500 truncate max-w-[100px]">{profile?.email}</span>
					</div>
				</div>
			</div>

			<!-- Logout Button -->
			<form action="/login?/logout" method="POST" class="w-full">
				<button 
					type="submit" 
					class="w-full flex items-center justify-center gap-2 px-3 py-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 text-zinc-400 hover:text-rose-400 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer"
				>
					<LogOut class="h-3.5 w-3.5" />
					Sign Out
				</button>
			</form>
		</div>
	</aside>

	<!-- Main Workspace Area -->
	<main class="flex-1 bg-zinc-950/45 p-6 md:p-10 flex flex-col">
		{@render children()}
	</main>
</div>
