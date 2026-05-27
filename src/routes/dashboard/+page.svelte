<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import { 
		Search, 
		Plus, 
		TrendingUp, 
		CheckCircle, 
		Clock, 
		AlertTriangle, 
		Trash2, 
		Eye, 
		FileText, 
		DollarSign, 
		Filter,
		Calendar
	} from '@lucide/svelte';

	let { data, form } = $props();

	// Active role state
	const profile = $derived(data.profile);
	const canManage = $derived(profile?.role === 'admin' || profile?.role === 'editor');
	const isAdmin = $derived(profile?.role === 'admin');

	// Local states for search and filtering
	let searchQuery = $state('');
	let statusFilter = $state<'all' | 'draft' | 'pending' | 'paid' | 'overdue'>('all');
	
	// Delete confirmation modal states
	let invoiceToDelete = $state<{ id: string; number: string } | null>(null);
	let deleteLoading = $state(false);

	const invoices = $derived(data.invoices || []);

	// Metric calculations (derived)
	const totalInvoiced = $derived(invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0));
	const totalPaid = $derived(invoices.filter(i => i.status === 'paid').reduce((sum, inv) => sum + Number(inv.total_amount), 0));
	const totalPending = $derived(invoices.filter(i => i.status === 'pending' || i.status === 'draft').reduce((sum, inv) => sum + Number(inv.total_amount), 0));
	const totalOverdue = $derived(invoices.filter(i => i.status === 'overdue').reduce((sum, inv) => sum + Number(inv.total_amount), 0));

	// Filtered invoices (derived)
	const filteredInvoices = $derived(
		invoices.filter(inv => {
			const matchesSearch = 
				inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
				inv.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				inv.client_email.toLowerCase().includes(searchQuery.toLowerCase());
			
			const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
			
			return matchesSearch && matchesStatus;
		})
	);

	// Formatter helper
	function formatCurrency(val: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
	}
</script>

<svelte:head>
	<title>Panel - FacturaFlow</title>
</svelte:head>

<div class="space-y-8 flex-1 flex flex-col justify-start text-[#171717]">
	<!-- Top Bar -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#ededed] pb-5">
		<div>
			<h1 class="text-2xl font-medium text-[#171717] tracking-tight">Facturas de la organización</h1>
			<p class="text-[#707070] text-xs mt-0.5">Seguimiento, análisis y gestión de las facturas de clientes.</p>
		</div>
		
		<!-- Only Admins & Editors can create new invoices -->
		{#if canManage}
			<a href={resolve('/dashboard/invoices/new')} class="w-full sm:w-auto">
				<Button class="flex items-center justify-center gap-2 w-full sm:w-auto">
					<Plus class="h-4.5 w-4.5" />
					Crear factura
				</Button>
			</a>
		{:else}
			<div class="text-xs text-[#707070] bg-[#fafafa] border border-[#ededed] px-3 py-2 rounded-[6px] flex items-center gap-1.5 self-stretch sm:self-auto">
				<Clock class="h-4 w-4 text-[#707070]" />
				Modo lector: creación de facturas deshabilitada
			</div>
		{/if}
	</div>

	<!-- Error state banner -->
	{#if form?.error}
		<div class="bg-[#e2005a]/10 border border-[#e2005a]/20 p-4 rounded-xl text-sm text-[#e2005a] flex items-start gap-2.5 shadow-sm">
			<AlertTriangle class="h-5 w-5 flex-shrink-0 mt-0.5" />
			<div>
				<p class="font-medium">Error de base de datos</p>
				<p class="text-xs text-[#707070] mt-0.5">{form.error}</p>
			</div>
		</div>
	{/if}

	<!-- Metrics Cards -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
		<!-- Card 1 -->
		<Card class="bg-white">
			<CardContent class="p-6 flex items-center justify-between">
				<div class="space-y-1">
				<p class="text-[#707070] text-[10px] font-medium uppercase tracking-wider">Total facturado</p>
				<p class="text-2xl font-medium text-[#171717] font-mono">{formatCurrency(totalInvoiced)}</p>
			</div>
			<div class="bg-[#fafafa] p-3 rounded-[6px] border border-[#ededed]">
				<TrendingUp class="h-6 w-6 text-[#707070]" />
			</div>
		</CardContent>
	</Card>

		<!-- Card 2 -->
		<Card class="bg-white">
			<CardContent class="p-6 flex items-center justify-between">
				<div class="space-y-1">
				<p class="text-[#707070] text-[10px] font-medium uppercase tracking-wider">Monto pagado</p>
				<p class="text-2xl font-medium text-[#24b47e] font-mono">{formatCurrency(totalPaid)}</p>
			</div>
			<div class="bg-[#3ecf8e]/12 p-3 rounded-[6px] border border-[#3ecf8e]/25">
				<CheckCircle class="h-6 w-6 text-[#24b47e]" />
			</div>
		</CardContent>
	</Card>

		<!-- Card 3 -->
		<Card class="bg-white">
			<CardContent class="p-6 flex items-center justify-between">
				<div class="space-y-1">
				<p class="text-[#707070] text-[10px] font-medium uppercase tracking-wider">Pendiente</p>
				<p class="text-2xl font-medium text-[#171717] font-mono">{formatCurrency(totalPending)}</p>
			</div>
			<div class="bg-[#fafafa] p-3 rounded-[6px] border border-[#ededed]">
				<Clock class="h-6 w-6 text-[#707070]" />
			</div>
		</CardContent>
	</Card>

		<!-- Card 4 -->
		<Card class="bg-white">
			<CardContent class="p-6 flex items-center justify-between">
				<div class="space-y-1">
				<p class="text-[#707070] text-[10px] font-medium uppercase tracking-wider">Monto vencido</p>
				<p class="text-2xl font-medium text-[#e2005a] font-mono">{formatCurrency(totalOverdue)}</p>
			</div>
			<div class="bg-[#e2005a]/10 p-3 rounded-[6px] border border-[#e2005a]/20">
				<AlertTriangle class="h-6 w-6 text-[#e2005a]" />
			</div>
		</CardContent>
	</Card>
	</div>

	<!-- Filters & Actions -->
	<div class="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-white p-4 border border-[#dfdfdf] rounded-lg">
		<!-- Search input -->
		<div class="relative flex-1 max-w-md">
			<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9a9a9a]">
				<Search class="h-4 w-4" />
			</div>
			<input
				type="text"
					placeholder="Buscar por cliente o factura..."
				bind:value={searchQuery}
				class="block w-full pl-9 pr-3 py-2 bg-white border border-[#dfdfdf] rounded-[6px] text-sm text-[#171717] placeholder:text-[#9a9a9a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:border-[#24b47e] transition-colors duration-200"
			/>
		</div>

		<!-- Status tab selection -->
		<div class="flex flex-wrap items-center gap-1.5">
			<span class="text-xs font-medium text-[#707070] mr-2 flex items-center gap-1">
				<Filter class="h-3.5 w-3.5" />
				Estado:
			</span>
			{#each ['all', 'draft', 'pending', 'paid', 'overdue'] as item (item)}
				<button
				class="px-3 py-1.5 rounded-[6px] text-xs font-medium capitalize transition-colors duration-200 cursor-pointer {statusFilter === item ? 'bg-[#3ecf8e] text-[#171717] border border-[#24b47e]' : 'text-[#707070] hover:text-[#171717] bg-transparent border border-transparent'}"
					onclick={() => (statusFilter = item as any)}
				>
					{item}
				</button>
			{/each}
		</div>
	</div>

	<!-- Invoices Data Table -->
	<Card class="bg-white">
		<div class="overflow-x-auto w-full">
			<table class="w-full text-sm text-left text-[#171717]">
				<thead class="text-xs uppercase bg-[#fafafa] text-[#707070] border-b border-[#ededed] tracking-wider">
					<tr>
						<th class="px-6 py-4 font-bold">Factura</th>
						<th class="px-6 py-4 font-bold">Cliente</th>
						<th class="px-6 py-4 font-bold">Vence</th>
						<th class="px-6 py-4 font-bold">Monto</th>
						<th class="px-6 py-4 font-bold">Estado</th>
						<th class="px-6 py-4 font-bold">Creado por</th>
						<th class="px-6 py-4 font-bold text-right">Acciones</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-[#ededed]">
					{#if filteredInvoices.length === 0}
						<tr>
							<td colspan="7" class="px-6 py-12 text-center text-[#707070] text-xs">
								No se encontraron facturas. Agrega una para comenzar.
							</td>
						</tr>
					{:else}
						{#each filteredInvoices as inv (inv.id)}
							<tr class="hover:bg-[#fafafa] transition-colors duration-150">
								<td class="px-6 py-4 font-medium text-[#171717] whitespace-nowrap">
									<a href={resolve(`/dashboard/invoices/${inv.id}`)} class="hover:text-[#24b47e] transition-colors flex items-center gap-1.5">
										<FileText class="h-4 w-4 text-[#9a9a9a]" />
										{inv.invoice_number}
									</a>
								</td>
								<td class="px-6 py-4">
									<div>
										<p class="font-medium text-[#171717]">{inv.client_name}</p>
										<p class="text-[11px] text-[#707070]">{inv.client_email}</p>
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="flex items-center gap-1.5 text-xs text-[#707070]">
										<Calendar class="h-3.5 w-3.5 text-[#9a9a9a]" />
										{new Date(inv.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
									</div>
								</td>
							<td class="px-6 py-4 font-medium text-[#171717] font-mono">
									{formatCurrency(Number(inv.total_amount))}
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									{#if inv.status === 'paid'}
										<Badge variant="success">Pagada</Badge>
									{:else if inv.status === 'pending'}
										<Badge variant="warning">Pendiente</Badge>
									{:else if inv.status === 'overdue'}
										<Badge variant="danger">Vencida</Badge>
									{:else}
										<Badge variant="secondary">Borrador</Badge>
									{/if}
								</td>
							<td class="px-6 py-4 whitespace-nowrap text-xs text-[#707070]">
					{inv.profiles?.name || 'Usuario desconocido'}
								</td>
								<td class="px-6 py-4 text-right whitespace-nowrap">
									<div class="flex items-center justify-end gap-1.5">
									<a href={resolve(`/dashboard/invoices/${inv.id}`)}>
								<Button variant="ghost" size="icon" class="h-8 w-8 text-[#707070] hover:text-[#171717]" title="Ver detalles">
												<Eye class="h-4 w-4" />
											</Button>
										</a>
										
										<!-- Deleting option (Admins only) -->
										{#if isAdmin}
									<Button 
										variant="ghost" 
										size="icon" 
										class="h-8 w-8 text-[#707070] hover:text-[#e2005a]" 
							title="Eliminar factura"
												onclick={() => (invoiceToDelete = { id: inv.id, number: inv.invoice_number })}
											>
												<Trash2 class="h-4 w-4" />
											</Button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</Card>
</div>

<!-- Delete Confirmation Modal -->
{#if invoiceToDelete}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm">
		<Card class="w-full max-w-sm">
			<CardContent class="p-6 space-y-4">
				<div class="flex items-center gap-2.5 text-[#e2005a]">
					<AlertTriangle class="h-6 w-6" />
					<h3 class="font-medium text-lg">Confirmar eliminación</h3>
				</div>
				
				<p class="text-sm text-[#707070] leading-relaxed">
					¿Seguro que deseas eliminar la factura <strong class="text-[#171717]">{invoiceToDelete.number}</strong>? Esta acción es permanente y no se puede deshacer.
				</p>
				
				<div class="flex justify-end gap-3 pt-2">
					<Button 
						variant="outline" 
						size="sm" 
						disabled={deleteLoading}
						onclick={() => (invoiceToDelete = null)}
					>
						Cancelar
					</Button>
					
					<form 
						action="?/deleteInvoice" 
						method="POST" 
						use:enhance={() => {
							deleteLoading = true;
							return async ({ result, update }) => {
								deleteLoading = false;
								invoiceToDelete = null;
								await update();
							};
						}}
					>
						<input type="hidden" name="id" value={invoiceToDelete.id} />
						<Button 
							type="submit" 
							variant="destructive" 
							size="sm"
							disabled={deleteLoading}
						>
							{#if deleteLoading}
							Eliminando...
							{:else}
							Eliminar
							{/if}
						</Button>
					</form>
				</div>
			</CardContent>
		</Card>
	</div>
{/if}
