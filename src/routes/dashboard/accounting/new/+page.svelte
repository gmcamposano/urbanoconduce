<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import { ArrowLeft, Save, AlertTriangle, Banknote, CreditCard, Wallet, Building2 } from '@lucide/svelte';

	let { data, form } = $props();

	const clients = $derived(data.clients || []);
	const invoices = $derived(data.invoices || []);

	let selectedClientId = $state('');
	let selectedInvoiceId = $state('');
	let amount = $state('');
	let paymentDate = $state(new Date().toISOString().split('T')[0]);
	let paymentMethod = $state('');
	let referenceNumber = $state('');
	let notes = $state('');
	let saving = $state(false);

	const filteredInvoices = $derived(
		selectedClientId
			? invoices.filter((inv) => inv.client_id === selectedClientId)
			: []
	);

	const selectedInvoice = $derived(
		selectedInvoiceId ? invoices.find((inv) => inv.id === selectedInvoiceId) : null
	);

	const clientMap = $derived(
		clients.reduce((acc, c) => {
			acc[c.id] = c;
			return acc;
		}, {} as Record<string, { client_type: string; full_name: string; company_name: string; alias: string; rnc: string; email: string }>)
	);

	const getClientDisplay = (clientId: string) => {
		const c = clientMap[clientId];
		if (!c) return '';
		return c.client_type === 'company' ? `${c.company_name} (${c.alias})` : c.full_name;
	};

	const formatCurrency = (val: number) => {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
	};

	const paymentMethods = [
		{ value: 'cash', label: 'Efectivo', icon: Banknote },
		{ value: 'transfer', label: 'Transferencia', icon: Building2 },
		{ value: 'check', label: 'Cheque', icon: Wallet },
		{ value: 'card', label: 'Tarjeta', icon: CreditCard },
		{ value: 'other', label: 'Otro', icon: Wallet }
	];
</script>

<svelte:head>
	<title>Registrar Pago - magikalInvoice</title>
</svelte:head>

<div class="flex flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<div class="flex items-center gap-4">
		<a
			href={resolve('/dashboard/accounting')}
			class="flex items-center gap-2 text-sm text-[#707070] transition-colors hover:text-[#171717]"
		>
			<ArrowLeft class="h-4 w-4" />
			Volver a contabilidad
		</a>
	</div>

	<div>
		<h1 class="text-2xl font-medium tracking-tight text-[#171717]">Registrar pago</h1>
		<p class="mt-0.5 text-xs text-[#707070]">Registra un nuevo pago recibido de un cliente.</p>
	</div>

	{#if form?.error}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
		>
			<AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" />
			<div>
				<p class="font-medium">Error</p>
				<p class="mt-0.5 text-xs text-[#707070]">{form.error}</p>
			</div>
		</div>
	{/if}

	<form
		method="POST"
		action="?/createPayment"
		use:enhance={() => {
			saving = true;
			return async ({ result, update }) => {
				saving = false;
				if (result.type !== 'redirect') {
					await update();
				}
			};
		}}
		class="space-y-6"
	>
		<Card class="bg-white">
			<CardHeader>
				<CardTitle>Información del pago</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<label for="client_id" class="text-sm font-medium text-[#171717]">
							Cliente <span class="text-[#e2005a]">*</span>
						</label>
						<select
							id="client_id"
							name="client_id"
							bind:value={selectedClientId}
							class="w-full rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
							required
						>
							<option value="">Seleccionar cliente</option>
							{#each clients as client (client.id)}
								<option value={client.id}>{getClientDisplay(client.id)}</option>
							{/each}
						</select>
					</div>

					<div class="space-y-2">
						<label for="invoice_id" class="text-sm font-medium text-[#171717]">
							Factura asociada <span class="text-xs text-[#707070]">(opcional)</span>
						</label>
						<select
							id="invoice_id"
							name="invoice_id"
							bind:value={selectedInvoiceId}
							class="w-full rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
						>
							<option value="">Sin factura específica</option>
							{#each filteredInvoices as inv (inv.id)}
								<option value={inv.id}>
									{inv.invoice_number} - {formatCurrency(Number(inv.total_amount))} (pendiente: {formatCurrency(Number(inv.total_amount))})
								</option>
							{/each}
						</select>
						{#if selectedClientId && filteredInvoices.length === 0}
							<p class="text-xs text-[#707070]">No hay facturas pendientes para este cliente.</p>
						{/if}
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<label for="amount" class="text-sm font-medium text-[#171717]">
							Monto <span class="text-[#e2005a]">*</span>
						</label>
						<div class="relative">
							<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#707070]">$</span>
							<input
								type="number"
								id="amount"
								name="amount"
								step="0.01"
								min="0.01"
								bind:value={amount}
								placeholder="0.00"
								class="w-full rounded-md border border-[#dfdfdf] bg-white py-2 pr-3 pl-7 text-sm text-[#171717] placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
								required
							/>
						</div>
						{#if selectedInvoice}
							<p class="text-xs text-[#707070]">
								Monto pendiente: {formatCurrency(Number(selectedInvoice.total_amount))}
							</p>
						{/if}
					</div>

					<div class="space-y-2">
						<label for="payment_date" class="text-sm font-medium text-[#171717]">
							Fecha de pago <span class="text-[#e2005a]">*</span>
						</label>
						<input
							type="date"
							id="payment_date"
							name="payment_date"
							bind:value={paymentDate}
							class="w-full rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
							required
						/>
					</div>
				</div>

				<div class="space-y-2">
					<label class="text-sm font-medium text-[#171717]">
						Método de pago <span class="text-[#e2005a]">*</span>
					</label>
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
						{#each paymentMethods as method (method.value)}
							<label
								class="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-center transition-colors {paymentMethod ===
								method.value
									? 'border-[#24b47e] bg-[#3ecf8e]/10 text-[#171717]'
									: 'border-[#dfdfdf] text-[#707070] hover:border-[#b2b2b2] hover:bg-[#fafafa]'}"
							>
								<input
									type="radio"
									name="payment_method"
									value={method.value}
									bind:group={paymentMethod}
									class="sr-only"
									required
								/>
								<method.icon class="h-5 w-5" />
								<span class="text-xs font-medium">{method.label}</span>
							</label>
						{/each}
					</div>
				</div>

				<div class="space-y-2">
					<label for="reference_number" class="text-sm font-medium text-[#171717]">
						Número de referencia <span class="text-xs text-[#707070]">(opcional)</span>
					</label>
					<input
						type="text"
						id="reference_number"
						name="reference_number"
						bind:value={referenceNumber}
						placeholder="Número de cheque, transacción, etc."
						class="w-full rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
					/>
				</div>

				<div class="space-y-2">
					<label for="notes" class="text-sm font-medium text-[#171717]">
						Notas <span class="text-xs text-[#707070]">(opcional)</span>
					</label>
					<textarea
						id="notes"
						name="notes"
						bind:value={notes}
						rows="3"
						placeholder="Notas adicionales sobre el pago..."
						class="w-full rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none resize-none"
					></textarea>
				</div>
			</CardContent>
		</Card>

		<div class="flex items-center justify-end gap-3">
			<a href={resolve('/dashboard/accounting')}>
				<Button variant="outline" type="button">Cancelar</Button>
			</a>
			<Button type="submit" disabled={saving}>
				{#if saving}
					Guardando...
				{:else}
					<Save class="mr-2 h-4 w-4" />
					Registrar pago
				{/if}
			</Button>
		</div>
	</form>
</div>