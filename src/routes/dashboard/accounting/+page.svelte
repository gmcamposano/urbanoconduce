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
		CircleDollarSign,
		Clock,
		AlertTriangle,
		Trash2,
		Eye,
		Edit3,
		Receipt,
		Calendar
	} from '@lucide/svelte';

	let { data, form } = $props();

	const profile = $derived(data.profile);
	const canManage = $derived(profile?.role === 'admin' || profile?.role === 'editor');
	const isAdmin = $derived(profile?.role === 'admin');

	let searchQuery = $state('');
	let paymentToDelete = $state<{ id: string; client: string } | null>(null);
	let deleteLoading = $state(false);
	let confirmText = $state('');

	const payments = $derived(data.payments || []);
	const outstandingInvoices = $derived(data.outstandingInvoices || []);
	const clients = $derived(data.clients || []);
	const clientBalances = $derived(data.clientBalances || []);

	const totalReceived = $derived(payments.reduce((sum, p) => sum + Number(p.amount), 0));

	const totalOutstanding = $derived(
		outstandingInvoices.reduce((sum, inv) => sum + Number(inv.balanceDue), 0)
	);

	const totalOverdue = $derived(
		outstandingInvoices
			.filter((i) => i.status === 'overdue')
			.reduce((sum, inv) => sum + Number(inv.balanceDue), 0)
	);

	const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 0, 0, 0, 0);

	const thisMonthCollections = $derived(
		payments
			.filter((p) => new Date(p.payment_date) >= thisMonth)
			.reduce((sum, p) => sum + Number(p.amount), 0)
	);

	const clientMap = $derived(
		clients.reduce(
			(acc, c) => {
				acc[c.id] = c;
				return acc;
			},
			{} as Record<
				string,
				{ client_type: string; full_name: string; alias: string; company_name: string }
			>
		)
	);

	const getClientDisplay = (clientId: string) => {
		const c = clientMap[clientId];
		if (!c) return 'Cliente desconocido';
		return c.client_type === 'company' ? c.company_name : c.full_name;
	};

	const filteredPayments = $derived(
		payments.filter((p) => p.searchText.includes(searchQuery.toLowerCase()))
	);

	const outstandingByClient = $derived(clientBalances);

	const formatCurrency = (val: number) => {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
	};

	const getMethodLabel = (method: string) => {
		switch (method) {
			case 'cash':
				return 'Efectivo';
			case 'transfer':
				return 'Transferencia';
			case 'check':
				return 'Cheque';
			case 'card':
				return 'Tarjeta';
			default:
				return 'Otro';
		}
	};
</script>

<svelte:head>
	<title>Contabilidad - magikalInvoice</title>
</svelte:head>

<div class="flex flex-1 flex-col justify-start space-y-8 text-[#171717]">
	<div
		class="flex flex-col items-start justify-between gap-4 border-b border-[#ededed] pb-5 sm:flex-row sm:items-center"
	>
		<div>
			<h1 class="text-2xl font-medium tracking-tight text-[#171717]">Contabilidad</h1>
			<p class="mt-0.5 text-xs text-[#707070]">
				Seguimiento de pagos y saldos pendientes de clientes.
			</p>
		</div>

		{#if canManage}
			<a href={resolve('/dashboard/accounting/new')} class="w-full sm:w-auto">
				<Button class="flex w-full items-center justify-center gap-2 sm:w-auto">
					<Plus class="h-4.5 w-4.5" />
					Registrar pago
				</Button>
			</a>
		{:else}
			<div
				class="flex items-center gap-1.5 self-stretch rounded-md border border-[#ededed] bg-[#fafafa] px-3 py-2 text-xs text-[#707070] sm:self-auto"
			>
				<Clock class="h-4 w-4 text-[#707070]" />
				Modo lector
			</div>
		{/if}
	</div>

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

	<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
		<Card class="bg-white">
			<CardContent class="flex items-center justify-between p-6">
				<div class="space-y-1">
					<p class="text-[10px] font-medium tracking-wider text-[#707070] uppercase">
						Total recibido
					</p>
					<p class="font-mono text-2xl font-medium text-[#171717]">
						{formatCurrency(totalReceived)}
					</p>
				</div>
				<div class="rounded-md border border-[#ededed] bg-[#fafafa] p-3">
					<CircleDollarSign class="h-6 w-6 text-[#707070]" />
				</div>
			</CardContent>
		</Card>

		<Card class="bg-white">
			<CardContent class="flex items-center justify-between p-6">
				<div class="space-y-1">
					<p class="text-[10px] font-medium tracking-wider text-[#707070] uppercase">
						Total pendiente
					</p>
					<p class="font-mono text-2xl font-medium text-[#171717]">
						{formatCurrency(totalOutstanding)}
					</p>
				</div>
				<div class="rounded-md border border-[#ededed] bg-[#fafafa] p-3">
					<Clock class="h-6 w-6 text-[#707070]" />
				</div>
			</CardContent>
		</Card>

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

		<Card class="bg-white">
			<CardContent class="flex items-center justify-between p-6">
				<div class="space-y-1">
					<p class="text-[10px] font-medium tracking-wider text-[#707070] uppercase">Este mes</p>
					<p class="font-mono text-2xl font-medium text-[#24b47e]">
						{formatCurrency(thisMonthCollections)}
					</p>
				</div>
				<div class="rounded-md border border-[#3ecf8e]/25 bg-[#3ecf8e]/12 p-3">
					<TrendingUp class="h-6 w-6 text-[#24b47e]" />
				</div>
			</CardContent>
		</Card>
	</div>

	<div
		class="flex flex-col items-stretch justify-between gap-4 rounded-lg border border-[#dfdfdf] bg-white p-4 md:flex-row md:items-center"
	>
		<div class="relative max-w-md flex-1">
			<div
				class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#9a9a9a]"
			>
				<Search class="h-4 w-4" />
			</div>
			<input
				type="text"
				placeholder="Buscar por cliente, factura o referencia..."
				bind:value={searchQuery}
				class="block w-full rounded-md border border-[#dfdfdf] bg-white py-2 pr-3 pl-9 text-sm text-[#171717] transition-colors duration-200 placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
			/>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="lg:col-span-2">
			<Card class="bg-white">
				<div class="border-b border-[#ededed] px-6 py-4">
					<h2 class="text-base font-medium text-[#171717]">Pagos registrados</h2>
				</div>
				<div class="w-full overflow-x-auto">
					<table class="w-full text-left text-sm text-[#171717]">
						<thead
							class="border-b border-[#ededed] bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase"
						>
							<tr>
								<th class="px-6 py-4 font-bold">Fecha</th>
								<th class="px-6 py-4 font-bold">Cliente</th>
								<th class="px-6 py-4 font-bold">Factura</th>
								<th class="px-6 py-4 font-bold">Monto</th>
								<th class="px-6 py-4 font-bold">Método</th>
								<th class="px-6 py-4 font-bold capitalize">Creado Por</th>
								<th class="px-6 py-4 text-right font-bold">Acciones</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[#ededed]">
							{#if filteredPayments.length === 0}
								<tr>
									<td colspan="7" class="px-6 py-12 text-center text-xs text-[#707070]">
										No se encontraron pagos registrados.
									</td>
								</tr>
							{:else}
								{#each filteredPayments as payment (payment.id)}
									<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
										<td class="px-6 py-4 whitespace-nowrap">
											<div class="flex items-center gap-1.5 text-xs text-[#707070]">
												<Calendar class="h-3.5 w-3.5 text-[#9a9a9a]" />
												{new Date(payment.payment_date).toLocaleDateString('en-US', {
													month: 'short',
													day: 'numeric',
													year: 'numeric',
													timeZone: 'UTC'
												})}
											</div>
										</td>
										<td class="px-6 py-4">
											<p class="font-medium text-[#171717]">
												{getClientDisplay(payment.client_id)}
											</p>
										</td>
										<td class="px-6 py-4">
											<div class="flex items-center gap-1.5 text-xs text-[#707070]">
												<Receipt class="h-3.5 w-3.5" />
												{payment.invoiceSummary}
											</div>
										</td>
										<td class="px-6 py-4 font-mono font-medium text-[#24b47e]">
											{formatCurrency(Number(payment.amount))}
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<Badge variant="secondary">{getMethodLabel(payment.payment_method)}</Badge>
										</td>
										<td class="px-6 py-4 text-xs whitespace-nowrap text-[#707070]">
											{payment.profiles?.name || 'Usuario'}
										</td>
										<td class="px-6 py-4 text-right whitespace-nowrap">
											<div class="flex items-center justify-end gap-1.5">
												<a href={resolve(`/dashboard/accounting/${payment.id}`)}>
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
													<a href={resolve(`/dashboard/accounting/${payment.id}/edit`)}>
														<Button
															variant="ghost"
															size="icon"
															class="h-8 w-8 text-[#707070] hover:text-[#171717]"
															title="Editar pago"
														>
															<Edit3 class="h-4 w-4" />
														</Button>
													</a>

													<Button
														variant="ghost"
														size="icon"
														class="h-8 w-8 text-[#707070] hover:text-[#e2005a]"
														title="Eliminar pago"
														onclick={() =>
															(paymentToDelete = {
																id: payment.id,
																client: getClientDisplay(payment.client_id)
															})}
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

		<div class="lg:col-span-1">
			<Card class="bg-white">
				<div class="border-b border-[#ededed] px-6 py-4">
					<h2 class="text-base font-medium text-[#171717]">Saldos pendientes por cliente</h2>
				</div>
				<div class="divide-y divide-[#ededed]">
					{#if outstandingByClient.length === 0}
						<div class="px-6 py-8 text-center text-xs text-[#707070]">
							No hay facturas pendientes.
						</div>
					{:else}
						{#each outstandingByClient as item (item.clientId)}
							<div class="flex items-center justify-between px-6 py-4">
								<div class="min-w-0 flex-1">
									<p class="truncate font-medium text-[#171717]">{item.name}</p>
									<p class="mt-0.5 text-xs text-[#707070]">
										{item.invoiceCount} proforma(s) pendiente(s)
										{#if item.overdueBalance > 0}
											· {formatCurrency(item.overdueBalance)} vencido
										{/if}
									</p>
								</div>
								<p class="font-mono text-sm font-medium text-[#e2005a]">
									{formatCurrency(item.totalBalance)}
								</p>
							</div>
						{/each}
					{/if}
				</div>
			</Card>
		</div>
	</div>
</div>

{#if paymentToDelete}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
		<Card class="w-full max-w-sm">
			<CardContent class="space-y-4 p-6">
				<div class="flex items-center gap-2.5 text-[#e2005a]">
					<AlertTriangle class="h-6 w-6" />
					<h3 class="text-lg font-medium">Confirmar eliminación</h3>
				</div>

				<p class="text-sm leading-relaxed text-[#707070]">
					¿Seguro que deseas eliminar este pago de <strong class="text-[#171717]"
						>{paymentToDelete.client}</strong
					>? Esta acción es permanente y no se puede deshacer.
				</p>

				<div class="space-y-2">
					<label for="confirmDelete" class="text-xs font-medium text-[#707070]">
						Escribe <strong class="text-[#171717]">eliminar</strong> para confirmar
					</label>
					<input
						id="confirmDelete"
						type="text"
						bind:value={confirmText}
						placeholder="eliminar"
						class="w-full rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] placeholder:text-[#9a9a9a] focus-visible:border-[#e2005a] focus-visible:ring-1 focus-visible:ring-[#e2005a]/30 focus-visible:outline-none"
					/>
				</div>

				<div class="flex justify-end gap-3 pt-2">
					<Button
						variant="outline"
						size="sm"
						disabled={deleteLoading}
						onclick={() => {
							paymentToDelete = null;
							confirmText = '';
						}}
					>
						Cancelar
					</Button>

					<form
						action="?/deletePayment"
						method="POST"
						use:enhance={() => {
							deleteLoading = true;
							return async ({ update }) => {
								deleteLoading = false;
								paymentToDelete = null;
								confirmText = '';
								await update();
							};
						}}
					>
						<input type="hidden" name="id" value={paymentToDelete.id} />
						<Button
							type="submit"
							variant="destructive"
							size="sm"
							disabled={deleteLoading || confirmText !== 'eliminar'}
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
