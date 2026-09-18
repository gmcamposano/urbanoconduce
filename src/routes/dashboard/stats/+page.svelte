<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import SalesByDescriptionChart from '$lib/components/charts/SalesByDescriptionChart.svelte';
	import { Package, Calendar, Users, FileText, Clock, Loader2 } from '@lucide/svelte';

	let { data } = $props();

	const clients = $derived(data.clients || []);
	const itemsByDescription = $derived(data.itemsByDescription || []);
	const unitsSold = $derived(Number(data.unitsSold || 0));
	const totalAmount = $derived(Number(data.totalAmount || 0));
	let loading = $state(false);

	let from = $state('');
	let to = $state('');
	let clientId = $state('all');
	let tipo = $state('all');

	$effect(() => {
		const params = page.url.searchParams;
		from = params.get('from') || data.from;
		to = params.get('to') || data.to;
		clientId = params.get('client') || data.clientId || 'all';
		tipo = params.get('tipo') || data.tipo || 'all';
	});

	const selectedClientName = $derived(
		clientId === 'all'
			? 'Todos los clientes'
			: clients.find((c) => c.id === clientId)?.company_name ||
					clients.find((c) => c.id === clientId)?.full_name ||
					''
	);

	const tableTitle = $derived(
		tipo === 'proforma'
			? 'Proformas por descripción'
			: tipo === 'factura'
				? 'Facturas por descripción'
				: 'Ventas por descripción'
	);

	async function applyFilters() {
		const params = new URLSearchParams({ from, to, client: clientId, tipo });
		loading = true;
		try {
			await goto(`/dashboard/stats?${params.toString()}`, { invalidateAll: true });
		} finally {
			loading = false;
		}
	}

	function onDateChange() {
		if (from && to && from > to) {
			[from, to] = [to, from];
		}
		applyFilters();
	}

	function applyPreset(months: number) {
		const now = new Date();
		to = now.toISOString().slice(0, 10);
		const start = new Date(now);
		start.setMonth(now.getMonth() - months);
		from = start.toISOString().slice(0, 10);
		applyFilters();
	}

	function isActivePreset(months: number) {
		const now = new Date();
		const start = new Date(now);
		start.setMonth(now.getMonth() - months);
		return from === start.toISOString().slice(0, 10) && to === now.toISOString().slice(0, 10);
	}

	function formatNumber(value: number) {
		return new Intl.NumberFormat('es-DO').format(value);
	}

	function formatCurrency(value: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
	}

	function formatRange() {
		const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
		return `${new Date(from + 'T00:00:00').toLocaleDateString('es-DO', opts)} — ${new Date(to + 'T00:00:00').toLocaleDateString('es-DO', opts)}`;
	}
</script>

<svelte:head>
	<title>Estadísticas - magikalInvoice</title>
</svelte:head>

<div class="flex flex-1 flex-col justify-start space-y-8 text-[#171717]">
	<div class="border-b border-[#ededed] pb-5">
		<h1 class="text-2xl font-medium tracking-tight text-[#171717]">Estadísticas</h1>
		<p class="mt-0.5 text-xs text-[#707070]">
			Inventario vendido en un rango de fechas, por cliente o en total.
		</p>
	</div>

	<div
		class="flex flex-col items-stretch justify-between gap-4 rounded-lg border border-[#dfdfdf] bg-white p-4 md:flex-row md:items-end"
	>
		<div class="flex flex-wrap items-end gap-4">
			<div class="space-y-1.5">
				<span class="flex items-center gap-1 text-xs font-medium text-[#707070]">
					<Clock class="h-3.5 w-3.5" />
					Rango rápido
				</span>
				<div class="flex flex-wrap items-center gap-1.5">
					<button
						type="button"
						class="cursor-pointer rounded-md border px-3 py-2 text-xs font-medium transition-colors duration-200 {isActivePreset(
							1
						)
							? 'border border-[#24b47e] bg-[#3ecf8e] text-[#171717]'
							: 'border-[#dfdfdf] bg-white text-[#707070] hover:text-[#171717]'}"
						disabled={loading}
						onclick={() => applyPreset(1)}
					>
						Último mes
					</button>
					<button
						type="button"
						class="cursor-pointer rounded-md border px-3 py-2 text-xs font-medium transition-colors duration-200 {isActivePreset(
							3
						)
							? 'border border-[#24b47e] bg-[#3ecf8e] text-[#171717]'
							: 'border-[#dfdfdf] bg-white text-[#707070] hover:text-[#171717]'}"
						disabled={loading}
						onclick={() => applyPreset(3)}
					>
						Últimos 3 meses
					</button>
					<button
						type="button"
						class="cursor-pointer rounded-md border px-3 py-2 text-xs font-medium transition-colors duration-200 {isActivePreset(
							12
						)
							? 'border border-[#24b47e] bg-[#3ecf8e] text-[#171717]'
							: 'border-[#dfdfdf] bg-white text-[#707070] hover:text-[#171717]'}"
						disabled={loading}
						onclick={() => applyPreset(12)}
					>
						Último año
					</button>
				</div>
			</div>

			<div class="space-y-1.5">
				<label for="stats-from" class="flex items-center gap-1 text-xs font-medium text-[#707070]">
					<Calendar class="h-3.5 w-3.5" />
					Desde
				</label>
				<input
					id="stats-from"
					type="date"
					bind:value={from}
					onchange={onDateChange}
					disabled={loading}
					class="rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				/>
			</div>

			<div class="space-y-1.5">
				<label for="stats-to" class="flex items-center gap-1 text-xs font-medium text-[#707070]">
					<Calendar class="h-3.5 w-3.5" />
					Hasta
				</label>
				<input
					id="stats-to"
					type="date"
					bind:value={to}
					onchange={onDateChange}
					disabled={loading}
					class="rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				/>
			</div>

			<div class="space-y-1.5">
				<label
					for="stats-client"
					class="flex items-center gap-1 text-xs font-medium text-[#707070]"
				>
					<Users class="h-3.5 w-3.5" />
					Cliente
				</label>
				<select
					id="stats-client"
					bind:value={clientId}
					onchange={applyFilters}
					disabled={loading}
					class="min-w-48 rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				>
					<option value="all">Todos los clientes</option>
					{#each clients as client (client.id)}
						<option value={client.id}>{client.company_name || client.full_name}</option>
					{/each}
				</select>
			</div>

			<div class="space-y-1.5">
				<label for="stats-tipo" class="flex items-center gap-1 text-xs font-medium text-[#707070]">
					<FileText class="h-3.5 w-3.5" />
					Tipo de documento
				</label>
				<select
					id="stats-tipo"
					bind:value={tipo}
					onchange={applyFilters}
					disabled={loading}
					class="min-w-40 rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				>
					<option value="all">Todos</option>
					<option value="proforma">Proformas</option>
					<option value="factura">Facturas</option>
				</select>
			</div>
		</div>

		<div class="flex items-center justify-end gap-2 md:pb-2.5">
			{#if loading}
				<Loader2 class="h-4 w-4 animate-spin text-[#24b47e]" />
				<span class="text-xs text-[#707070]">Actualizando...</span>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
		<Card class="bg-white lg:col-span-1">
			<CardContent class="p-6">
				<div class="mb-4 flex items-center justify-between gap-4">
					<div>
						<h2 class="text-sm font-medium text-[#171717]">
							Gráfico de {tableTitle.toLowerCase()}
						</h2>
						<p class="mt-0.5 text-[11px] text-[#707070]">
							Cantidad vendida por descripción · {formatRange()} · {selectedClientName}
						</p>
					</div>
				</div>
				<SalesByDescriptionChart data={itemsByDescription} height={240} />
			</CardContent>
		</Card>

		<Card class="bg-white lg:col-span-2">
			<CardContent class="p-6">
				<div class="mb-4 flex items-center justify-between gap-4">
					<div>
						<h2 class="text-sm font-medium text-[#171717]">{tableTitle}</h2>
						<p class="mt-0.5 text-[11px] text-[#707070]">
							{formatRange()} · {selectedClientName}
						</p>
					</div>
					<div
						class="flex shrink-0 items-center gap-2 rounded-md border border-[#3ecf8e]/25 bg-[#3ecf8e]/12 px-3 py-1.5"
					>
						<Package class="h-4 w-4 text-[#24b47e]" />
						<span class="text-xs font-medium text-[#171717]"
							>{formatNumber(unitsSold)} unidades · {formatCurrency(totalAmount)}</span
						>
					</div>
				</div>

				<div class="max-h-[calc(100vh-420px)] overflow-auto">
					<table class="w-full text-left text-sm text-[#171717]">
						<thead class="text-xs tracking-wider text-[#707070] uppercase">
							<tr class="sticky top-0 z-10 border-b border-[#ededed] bg-[#fafafa]">
								<th class="px-4 py-3 font-bold">Descripción</th>
								<th class="px-4 py-3 text-right font-bold">Cantidad</th>
								<th class="px-4 py-3 text-right font-bold">Monto</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[#ededed]">
							{#if itemsByDescription.length === 0}
								<tr>
									<td colspan="3" class="px-4 py-10 text-center text-xs text-[#707070]">
										No hay ventas en el rango seleccionado.
									</td>
								</tr>
							{:else}
								{#each itemsByDescription as item (item.description)}
									<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
										<td class="px-4 py-3 text-[#171717]">{item.description}</td>
										<td
											class="px-4 py-3 text-right font-mono font-medium text-[#171717] tabular-nums"
										>
											{formatNumber(item.quantity)}
										</td>
										<td
											class="px-4 py-3 text-right font-mono font-medium text-[#171717] tabular-nums"
										>
											{formatCurrency(item.amount)}
										</td>
									</tr>
								{/each}
							{/if}
						</tbody>
						{#if itemsByDescription.length > 0}
							<tfoot>
								<tr class="border-t border-[#ededed] bg-[#fafafa]">
									<td class="px-4 py-3 text-xs font-medium tracking-wider text-[#707070] uppercase">
										Total
									</td>
									<td
										class="px-4 py-3 text-right font-mono font-medium text-[#171717] tabular-nums"
									>
										{formatNumber(unitsSold)}
									</td>
									<td
										class="px-4 py-3 text-right font-mono font-medium text-[#171717] tabular-nums"
									>
										{formatCurrency(totalAmount)}
									</td>
								</tr>
							</tfoot>
						{/if}
					</table>
				</div>
			</CardContent>
		</Card>
	</div>
</div>
