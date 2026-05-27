<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from '$lib/components/ui/Card.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { 
		ShieldAlert, 
		User, 
		AlertTriangle, 
		Shield, 
		Check,
		Edit3
	} from '@lucide/svelte';

	let { data, form } = $props();

	const profiles = $derived(data.profiles || []);
	
	// Local tracking of which user is currently being updated to render spinner/loading feedback
	let updatingUserId = $state<string | null>(null);
</script>

<svelte:head>
	<title>Admin Panel - InvoiceFlow</title>
</svelte:head>

<div class="space-y-6 flex-1 flex flex-col justify-start">
	<!-- Header title -->
	<div class="border-b border-zinc-900 pb-5">
		<h1 class="text-2xl font-black text-white tracking-tight flex items-center gap-2">
			<ShieldAlert class="h-6 w-6 text-indigo-500" />
			System Control Panel
		</h1>
		<p class="text-zinc-500 text-xs mt-0.5">Manage user authorization privileges and configure system-wide roles.</p>
	</div>

	<!-- Alert Messages -->
	{#if form?.success}
		<div class="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-sm text-emerald-400 flex items-start gap-2.5 shadow-lg shadow-emerald-500/5">
			<Check class="h-5 w-5 flex-shrink-0 text-emerald-400 mt-0.5" />
			<div>
				<p class="font-bold">Role Updated</p>
				<p class="text-xs text-zinc-400 mt-0.5">The user's role has been updated and applied to Row Level Security policies.</p>
			</div>
		</div>
	{/if}

	{#if form?.error}
		<div class="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-sm text-rose-400 flex items-start gap-2.5 shadow-lg shadow-rose-500/5">
			<AlertTriangle class="h-5 w-5 flex-shrink-0 text-rose-400 mt-0.5" />
			<div>
				<p class="font-bold">Operation Failed</p>
				<p class="text-xs text-zinc-400 mt-0.5">{form.error}</p>
			</div>
		</div>
	{/if}

	<!-- Informative card explaining roles -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-5">
		<Card class="border-zinc-900 bg-zinc-950/20">
			<CardContent class="p-6 space-y-2">
				<Badge variant="danger">ADMIN</Badge>
				<p class="text-sm font-bold text-white mt-2">Full Administrative Control</p>
				<p class="text-xs text-zinc-500 leading-relaxed">
					Can read and write all organization invoices, delete invoices from history, and change roles of any user in the system.
				</p>
			</CardContent>
		</Card>

		<Card class="border-zinc-900 bg-zinc-950/20">
			<CardContent class="p-6 space-y-2">
				<Badge variant="info">EDITOR</Badge>
				<p class="text-sm font-bold text-white mt-2">Billing Operations Editor</p>
				<p class="text-xs text-zinc-500 leading-relaxed">
					Can create, edit, and view invoices and line items. Has no delete permissions and cannot access these settings.
				</p>
			</CardContent>
		</Card>

		<Card class="border-zinc-900 bg-zinc-950/20">
			<CardContent class="p-6 space-y-2">
				<Badge variant="secondary">VIEWER</Badge>
				<p class="text-sm font-bold text-white mt-2">Read-Only Auditing View</p>
				<p class="text-xs text-zinc-500 leading-relaxed">
					Has read-only rights to invoices. Cannot create, edit, or delete any billing sheets. Guarded strictly at the database layer.
				</p>
			</CardContent>
		</Card>
	</div>

	<!-- Profiles list -->
	<Card class="border-zinc-900 bg-zinc-950/15">
		<div class="overflow-x-auto w-full">
			<table class="w-full text-sm text-left text-zinc-300">
				<thead class="text-xs uppercase bg-zinc-950 text-zinc-500 border-b border-zinc-900 tracking-wider">
					<tr>
						<th class="px-6 py-4 font-bold">User Identity</th>
						<th class="px-6 py-4 font-bold">Email Address</th>
						<th class="px-6 py-4 font-bold">Current Role</th>
						<th class="px-6 py-4 font-bold text-right">Edit Permission / Assign Role</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-zinc-900/60">
					{#each profiles as item}
						<tr class="hover:bg-zinc-900/35 transition-colors duration-150">
							<td class="px-6 py-4 whitespace-nowrap font-bold text-white">
								<div class="flex items-center gap-2.5">
									<div class="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
										<User class="h-4 w-4 text-indigo-400" />
									</div>
									<span>{item.name || 'New User'}</span>
									{#if data.user?.id === item.id}
										<Badge variant="outline" class="text-[9px] px-1 py-0 border-indigo-500/20 text-indigo-400">YOU</Badge>
									{/if}
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap font-mono text-xs text-zinc-400">
								{item.email}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								{#if item.role === 'admin'}
									<Badge variant="danger">ADMIN</Badge>
								{:else if item.role === 'editor'}
									<Badge variant="info">EDITOR</Badge>
								{:else}
									<Badge variant="secondary">VIEWER</Badge>
								{/if}
							</td>
							<td class="px-6 py-4 text-right whitespace-nowrap">
								<!-- Disable actions for self to prevent locking self out -->
								{#if data.user?.id === item.id}
									<span class="text-xs text-zinc-500 font-semibold px-4">Self management disabled</span>
								{:else}
									<form 
										action="?/updateRole" 
										method="POST" 
										class="inline-flex items-center gap-1.5"
										use:enhance={() => {
											updatingUserId = item.id;
											return async ({ update }) => {
												updatingUserId = null;
												await update();
											};
										}}
									>
										<input type="hidden" name="id" value={item.id} />
										<select 
											name="role" 
											disabled={updatingUserId !== null}
						class="flex h-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 cursor-pointer"
						>
											<option value="viewer" selected={item.role === 'viewer'}>Viewer (Read Only)</option>
											<option value="editor" selected={item.role === 'editor'}>Editor (Create/Edit)</option>
											<option value="admin" selected={item.role === 'admin'}>Admin (Full Control)</option>
										</select>
										
										<Button 
											type="submit" 
											variant="secondary" 
											size="sm" 
											class="h-8 text-xs font-semibold px-2.5"
											disabled={updatingUserId !== null}
										>
											{#if updatingUserId === item.id}
												Saving...
											{:else}
												Apply
											{/if}
										</Button>
									</form>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</Card>
</div>
