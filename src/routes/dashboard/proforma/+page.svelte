<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import {
		Search,
		Plus,
		TrendingUp,
		CheckCircle,
		Clock,
		AlertTriangle,
		Edit3,
		Trash2,
		Eye,
		FileText,
		Filter,
		Calendar
	} from '@lucide/svelte';

	let { data, form } = $props();

	function toTitleCase(str: string): string {
		if (!str) return '';
		return str
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

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
	let confirmText = $state('');

	const invoices = $derived(data.invoices || []);
	const facturas = $derived(data.facturas || []);

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const todayTime = today.getTime();

	function isExpired(dueDate: string) {
		if (!dueDate) return false;
		const due = new Date(dueDate);
		return due.getTime() < todayTime;
	}

	function totalByClient<T extends { client_id: string; total_amount: number | string }>(
		rows: T[]
	): Map<string, number> {
		const map = new Map<string, number>();
		for (const row of rows) {
			map.set(row.client_id, (map.get(row.client_id) ?? 0) + Number(row.total_amount));
		}
		return map;
	}

	// Metric calculations (derived)
	// - Total facturado = sum of proforma total_amount.
	// - Monto pagado = sum of paidAmount on proformas.
	// - Pendiente: for each client, proforma total - factura total (clamped to 0).
	// - Vencido: same logic but only for proformas/facturas past their due_date.
	const totalInvoiced = $derived(invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0));
	const totalPaid = $derived(invoices.reduce((sum, inv) => sum + Number(inv.paidAmount || 0), 0));

	const totalPending = $derived.by(() => {
		const proformaByClient = totalByClient(invoices);
		const facturaByClient = totalByClient(facturas);
		let total = 0;
		for (const [clientId, proformaTotal] of proformaByClient) {
			const facturaTotal = facturaByClient.get(clientId) ?? 0;
			total += Math.max(0, proformaTotal - facturaTotal);
		}
		return total;
	});

	const totalOverdue = $derived.by(() => {
		const expiredProformaByClient = totalByClient(
			invoices.filter((p) => isExpired(p.due_date))
		);
		const expiredFacturaByClient = totalByClient(
			facturas.filter((f) => isExpired(f.due_date))
		);
		let total = 0;
		for (const [clientId, proformaTotal] of expiredProformaByClient) {
			const facturaTotal = expiredFacturaByClient.get(clientId) ?? 0;
			total += Math.max(0, proformaTotal - facturaTotal);
		}
		return total;
	});

	// Filtered invoices (derived)
	const filteredInvoices = $derived(
		invoices.filter((inv) => {
			const matchesSearch =
				inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(inv.client_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
				(inv.client_email || '').toLowerCase().includes(searchQuery.toLowerCase());

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
	<title>Proformas - magikalInvoice</title>
</svelte:head>

<div class="flex flex-1 flex-col justify-start space-y-8 text-[#171717]">
	<!-- Top Bar -->
	<div
		class="flex flex-col items-start justify-between gap-4 border-b border-[#ededed] pb-5 sm:flex-row sm:items-center"
	>
		<div>
			<h1 class="text-2xl font-medium tracking-tight text-[#171717]">
				Proformas de la organización
			</h1>
			<p class="mt-0.5 text-xs text-[#707070]">
				Seguimiento, análisis y gestión de las proformas de clientes.
			</p>
		</div>

		<!-- Only Admins & Editors can create new invoices -->
		{#if canManage}
			<a href={resolve('/dashboard/proforma/new')} class="w-full sm:w-auto">
				<Button class="flex w-full items-center justify-center gap-2 sm:w-auto">
					<Plus class="h-4.5 w-4.5" />
					Crear proforma
				</Button>
			</a>
		{:else}
			<div
				class="flex items-center gap-1.5 self-stretch rounded-md border border-[#ededed] bg-[#fafafa] px-3 py-2 text-xs text-[#707070] sm:self-auto"
			>
				<Clock class="h-4 w-4 text-[#707070]" />
				Modo lector: creación de proformas deshabilitada
			</div>
		{/if}
	</div>

	<!-- Error state banner -->
	{#if form?.error}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
		>
			<AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" />
			<div>
				<p class="font-medium">Error de base de datos</p>
				<p class="mt-0.5 text-xs text-[#707070]">{form.error}</p>
			</div>
		</div>
	{/if}

	<!-- Metrics Cards -->
	<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Card 1 -->
		<Card class="bg-white">
			<CardContent class="flex items-center justify-between p-6">
				<div class="space-y-1">
					<p class="text-[10px] font-medium tracking-wider text-[#707070] uppercase">
						Total facturado
					</p>
					<p class="font-mono text-2xl font-medium text-[#171717]">
						{formatCurrency(totalInvoiced)}
					</p>
				</div>
				<div class="rounded-md border border-[#ededed] bg-[#fafafa] p-3">
					<TrendingUp class="h-6 w-6 text-[#707070]" />
				</div>
			</CardContent>
		</Card>

		<!-- Card 2 -->
		<Card class="bg-white">
			<CardContent class="flex items-center justify-between p-6">
				<div class="space-y-1">
					<p class="text-[10px] font-medium tracking-wider text-[#707070] uppercase">
						Monto pagado
					</p>
					<p class="font-mono text-2xl font-medium text-[#24b47e]">{formatCurrency(totalPaid)}</p>
				</div>
				<div class="rounded-md border border-[#3ecf8e]/25 bg-[#3ecf8e]/12 p-3">
					<CheckCircle class="h-6 w-6 text-[#24b47e]" />
				</div>
			</CardContent>
		</Card>

		<!-- Card 3 -->
		<Card class="bg-white">
			<CardContent class="flex items-center justify-between p-6">
				<div class="space-y-1">
					<p class="text-[10px] font-medium tracking-wider text-[#707070] uppercase">Pendiente</p>
					<p class="font-mono text-2xl font-medium text-[#171717]">
						{formatCurrency(totalPending)}
					</p>
				</div>
				<div class="rounded-md border border-[#ededed] bg-[#fafafa] p-3">
					<Clock class="h-6 w-6 text-[#707070]" />
				</div>
			</CardContent>
		</Card>

		<!-- Card 4 -->
		<Card class="bg-white">
			<CardContent class="flex items-center justify-between p-6">
				<div class="space-y-1">
					<p class="text-[10px] font-medium tracking-wider text-[#707070] uppercase">
						Monto vencido
					</p>
					<p class="font-mono text-2xl font-medium text-[#e2005a]">
						{formatCurrency(totalOverdue)}
					</p>
				</div>
				<div class="rounded-md border border-[#e2005a]/20 bg-[#e2005a]/10 p-3">
					<AlertTriangle class="h-6 w-6 text-[#e2005a]" />
				</div>
			</CardContent>
		</Card>
	</div>

	<!-- Filters & Actions -->
	<div
		class="flex flex-col items-stretch justify-between gap-4 rounded-lg border border-[#dfdfdf] bg-white p-4 md:flex-row md:items-center"
	>
		<!-- Search input -->
		<div class="relative max-w-md flex-1">
			<div
				class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#9a9a9a]"
			>
				<Search class="h-4 w-4" />
			</div>
			<input
				type="text"
				placeholder="Buscar por cliente o proforma..."
				bind:value={searchQuery}
				class="block w-full rounded-md border border-[#dfdfdf] bg-white py-2 pr-3 pl-9 text-sm text-[#171717] transition-colors duration-200 placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
			/>
		</div>

		<!-- Status tab selection -->
		<div class="flex flex-wrap items-center gap-1.5">
			<span class="mr-2 flex items-center gap-1 text-xs font-medium text-[#707070]">
				<Filter class="h-3.5 w-3.5" />
				Estado:
			</span>
			{#each ['all', 'draft', 'pending', 'paid', 'overdue'] as item (item)}
				<button
					class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors duration-200 {statusFilter ===
					item
						? 'border border-[#24b47e] bg-[#3ecf8e] text-[#171717]'
						: 'border border-transparent bg-transparent text-[#707070] hover:text-[#171717]'}"
					onclick={() => (statusFilter = item as any)}
				>
					{item}
				</button>
			{/each}
		</div>
	</div>

	<!-- Invoices Data Table -->
	<Card class="bg-white">
		<div class="w-full overflow-x-auto">
			<table class="w-full text-left text-sm text-[#171717]">
				<thead
					class="border-b border-[#ededed] bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase"
				>
					<tr>
						<th class="px-6 py-4 font-bold">Factura</th>
						<th class="px-6 py-4 font-bold capitalize">Cliente</th>
						<th class="px-6 py-4 font-bold">Vence</th>
						<th class="px-6 py-4 font-bold">Monto</th>
						<th class="px-6 py-4 font-bold">Estado</th>
						<th class="px-6 py-4 font-bold capitalize">Creado Por</th>
						<th class="px-6 py-4 text-right font-bold">Acciones</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-[#ededed]">
					{#if filteredInvoices.length === 0}
						<tr>
							<td colspan="7" class="px-6 py-12 text-center text-xs text-[#707070]">
							No se encontraron proformas. Agrega una para comenzar.
							</td>
						</tr>
					{:else}
						{#each filteredInvoices as inv (inv.id)}
							<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
								<td class="px-6 py-4 font-medium whitespace-nowrap text-[#171717]">
									<a
										href={resolve(`/dashboard/proforma/${inv.id}`)}
										class="flex items-center gap-1.5 transition-colors hover:text-[#24b47e]"
									>
										<FileText class="h-4 w-4 text-[#9a9a9a]" />
										{inv.invoice_number}
									</a>
								</td>
								<td class="px-6 py-4">
									<div>
										<p class="font-medium text-[#171717]">{toTitleCase(inv.client_name || '')}</p>
										<p class="text-[11px] text-[#707070]">{inv.client_email || ''}</p>
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="flex items-center gap-1.5 text-xs text-[#707070]">
										<Calendar class="h-3.5 w-3.5 text-[#9a9a9a]" />
										{new Date(inv.due_date).toLocaleDateString('en-US', {
											month: 'short',
											day: 'numeric',
											year: 'numeric',
											timeZone: 'UTC'
										})}
									</div>
								</td>
								<td class="px-6 py-4 font-mono font-medium text-[#171717]">
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
								<td class="px-6 py-4 text-xs whitespace-nowrap text-[#707070]">
									{toTitleCase(inv.profiles?.name || 'Usuario desconocido')}
								</td>
								<td class="px-6 py-4 text-right whitespace-nowrap">
									<div class="flex items-center justify-end gap-1.5">
										<a href={resolve(`/dashboard/proforma/${inv.id}`)}>
											<Button
												variant="ghost"
												size="icon"
												class="h-8 w-8 text-[#707070] hover:text-[#171717]"
												title="Ver detalles"
											>
												<Eye class="h-4 w-4" />
											</Button>
										</a>

										{#if isAdmin}
											<a href={resolve(`/dashboard/proforma/${inv.id}/edit`)}>
												<Button
													variant="ghost"
													size="icon"
													class="h-8 w-8 text-[#707070] hover:text-[#171717]"
													title="Editar proforma"
												>
													<Edit3 class="h-4 w-4" />
												</Button>
											</a>
										{/if}

										<!-- Deleting option (Admins only) -->
										{#if isAdmin}
											<Button
												variant="ghost"
												size="icon"
												class="h-8 w-8 text-[#707070] hover:text-[#e2005a]"
												title="Eliminar proforma"
												onclick={() =>
													(invoiceToDelete = { id: inv.id, number: inv.invoice_number })}
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
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
		<Card class="w-full max-w-sm">
			<CardContent class="space-y-4 p-6">
				<div class="flex items-center gap-2.5 text-[#e2005a]">
					<AlertTriangle class="h-6 w-6" />
					<h3 class="text-lg font-medium">Confirmar eliminación</h3>
				</div>

				<p class="text-sm leading-relaxed text-[#707070]">
					¿Seguro que deseas eliminar la proforma <strong class="text-[#171717]"
						>{invoiceToDelete.number}</strong
					>? Esta acción es permanente y no se puede deshacer.
				</p>

				<div class="space-y-2">
					<label for="confirmDelete" class="text-xs font-medium text-[#707070]">
						Escribe <strong class="text-[#171717]">{invoiceToDelete.number}</strong> para confirmar
					</label>
					<input
						id="confirmDelete"
						type="text"
						bind:value={confirmText}
						placeholder={invoiceToDelete.number}
						class="w-full rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] placeholder:text-[#9a9a9a] focus-visible:border-[#e2005a] focus-visible:ring-1 focus-visible:ring-[#e2005a]/30 focus-visible:outline-none"
					/>
				</div>

				<div class="flex justify-end gap-3 pt-2">
					<Button
						variant="outline"
						size="sm"
						disabled={deleteLoading}
						onclick={() => {
							invoiceToDelete = null;
							confirmText = '';
						}}
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
								confirmText = '';
								await update();
							};
						}}
					>
						<input type="hidden" name="id" value={invoiceToDelete.id} />
						<Button
							type="submit"
							variant="destructive"
							size="sm"
							disabled={deleteLoading || confirmText !== invoiceToDelete?.number}
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
