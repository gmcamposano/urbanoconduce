<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import {
		AlertTriangle,
		ArrowLeft,
		Banknote,
		Building2,
		CreditCard,
		Save,
		Wallet
	} from '@lucide/svelte';

	type Mode = 'create' | 'edit';

	type Client = {
		id: string;
		client_type: string;
		full_name: string;
		company_name?: string | null;
		alias?: string | null;
		rnc?: string | null;
		email?: string | null;
	};

	type ClientBalance = {
		clientId: string;
		name: string;
		creditBalance: number;
		invoiceCount: number;
		overdueBalance: number;
	};

	type InitialPayment = {
		id?: string;
		client_id?: string | null;
		amount?: number | string | null;
		payment_date?: string | null;
		payment_method?: string | null;
		reference_number?: string | null;
		notes?: string | null;
	};

	type FormState = {
		error?: string;
	};

	let {
		mode = 'create',
		clients = [],
		clientBalances = [],
		initialPayment = null,
		form,
		actionUrl = '',
		onBack,
		onCancel
	}: {
		mode?: Mode;
		clients?: Client[];
		clientBalances?: ClientBalance[];
		initialPayment?: InitialPayment | null;
		form?: FormState | null;
		actionUrl?: string;
		onBack?: () => void;
		onCancel?: () => void;
	} = $props();

	const today = new Date().toISOString().split('T')[0];

	function toInputString(value: number | string | null | undefined) {
		return value == null ? '' : String(value);
	}

	function normalizeAmountInput(value: string) {
		const cleaned = value.replace(/,/g, '').replace(/[^\d.]/g, '');
		const [integerPart = '', ...decimalParts] = cleaned.split('.');
		const decimalPart = decimalParts.join('').slice(0, 2);
		const hasDecimal = cleaned.includes('.');

		if (!hasDecimal) return integerPart;
		return `${integerPart}.${decimalPart}`;
	}

	function formatAmountForDisplay(value: string) {
		if (!value) return '';

		const [integerPart = '', decimalPart = ''] = value.split('.');
		const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		const hasDecimal = value.includes('.');

		if (!hasDecimal) return formattedInteger;
		return `${formattedInteger}.${decimalPart}`;
	}

	const heading = $derived(mode === 'edit' ? 'Editar pago' : 'Registrar pago');
	const description = $derived(
		mode === 'edit'
			? 'Actualiza los datos registrados de este pago.'
			: 'Registra un abono que se aplicará automáticamente a sus proformas pendientes, empezando por la más antigua.'
	);
	const backLabel = $derived(mode === 'edit' ? 'Volver al detalle' : 'Volver a contabilidad');
	const submitLabel = $derived(mode === 'edit' ? 'Guardar cambios' : 'Registrar pago');
	const savingLabel = $derived(mode === 'edit' ? 'Guardando cambios...' : 'Guardando...');
	const helperText = $derived(
		mode === 'edit'
			? 'Saldo actual del cliente para referencia.'
			: 'Se aplicará automáticamente a las proformas pendientes más antiguas.'
	);
	const resolvedActionUrl = $derived(
		actionUrl || (mode === 'edit' ? '?/updatePayment' : '?/createPayment')
	);

	function createDraft() {
		return {
			selectedClientId: toInputString(initialPayment?.client_id),
			amount: toInputString(initialPayment?.amount),
			paymentDate: initialPayment?.payment_date
				? String(initialPayment.payment_date).slice(0, 10)
				: today,
			paymentMethod: toInputString(initialPayment?.payment_method),
			referenceNumber: toInputString(initialPayment?.reference_number),
			notes: toInputString(initialPayment?.notes)
		};
	}

	let draft = $state(createDraft());
	let amountDisplay = $state(formatAmountForDisplay(draft.amount));
	let saving = $state(false);

	function handleAmountInput(value: string) {
		draft.amount = normalizeAmountInput(value);
		amountDisplay = formatAmountForDisplay(draft.amount);
	}

	const clientMap = $derived(
		clients.reduce(
			(acc, client) => {
				acc[client.id] = client;
				return acc;
			},
			{} as Record<string, Client>
		)
	);

	const clientBalanceMap = $derived(
		clientBalances.reduce(
			(acc, balance) => {
				acc[balance.clientId] = balance;
				return acc;
			},
			{} as Record<string, ClientBalance>
		)
	);

	function getClientDisplay(clientId: string) {
		const client = clientMap[clientId];
		if (!client) return '';
		if (client.client_type === 'company') {
			return client.alias
				? `${client.company_name || client.full_name} (${client.alias})`
				: client.company_name || client.full_name;
		}
		return client.full_name;
	}

	const selectedClientCredit = $derived(
		draft.selectedClientId
			? (clientBalanceMap[draft.selectedClientId] ?? {
					clientId: draft.selectedClientId,
					name: getClientDisplay(draft.selectedClientId),
					creditBalance: 0,
					invoiceCount: 0,
					overdueBalance: 0
				})
			: null
	);

	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
	};

	const paymentMethods = [
		{ value: 'cash', label: 'Efectivo', icon: Banknote },
		{ value: 'transfer', label: 'Transferencia', icon: Building2 },
		{ value: 'check', label: 'Cheque', icon: Wallet },
		{ value: 'card', label: 'Tarjeta', icon: CreditCard },
		{ value: 'other', label: 'Otro', icon: Wallet }
	];
</script>

<div class="flex flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<div class="flex items-center gap-4">
		<button
			type="button"
			onclick={() => onBack?.()}
			class="flex items-center gap-2 text-sm text-[#707070] transition-colors hover:text-[#171717]"
		>
			<ArrowLeft class="h-4 w-4" />
			{backLabel}
		</button>
	</div>

	<div>
		<h1 class="text-2xl font-medium tracking-tight text-[#171717]">{heading}</h1>
		<p class="mt-0.5 text-xs text-[#707070]">{description}</p>
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
		action={resolvedActionUrl}
		use:enhance={() => {
			saving = true;
			return async ({ result }) => {
				saving = false;
				await applyAction(result);
			};
		}}
		class="space-y-6"
	>
		{#if mode === 'edit' && initialPayment?.id}
			<input type="hidden" name="id" value={initialPayment.id} />
		{/if}

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
							bind:value={draft.selectedClientId}
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
						<p class="text-sm font-medium text-[#171717]">Crédito disponible</p>
						{#if selectedClientCredit}
							<div
								class="rounded-md border border-[#ededed] bg-[#fafafa] px-3 py-2 text-xs text-[#707070]"
							>
								<p class="font-medium text-[#171717]">
									{selectedClientCredit.creditBalance > 0
										? 'Saldo disponible'
										: 'Sin crédito disponible'}
								</p>
								<p
									class={`mt-0.5 font-mono text-sm ${selectedClientCredit.creditBalance > 0 ? 'text-[#24b47e]' : 'text-[#e2005a]'}`}
								>
									{formatCurrency(selectedClientCredit.creditBalance)}
								</p>
								<p class="mt-1">
									{selectedClientCredit.invoiceCount} proforma(s) pendiente(s)
									{#if selectedClientCredit.overdueBalance > 0}
										· {formatCurrency(selectedClientCredit.overdueBalance)} vencido
									{/if}
								</p>
							</div>
						{:else}
							<div
								class="rounded-md border border-[#ededed] bg-[#fafafa] px-3 py-2 text-xs text-[#707070]"
							>
								Selecciona un cliente para ver el saldo disponible.
							</div>
						{/if}
					</div>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<label for="amount" class="text-sm font-medium text-[#171717]">
							Monto <span class="text-[#e2005a]">*</span>
						</label>
						<div class="relative">
							<span
								class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-[#707070]"
								>$</span
							>
							<input type="hidden" name="amount" value={draft.amount} />
							<input
								type="text"
								id="amount"
								inputmode="decimal"
								autocomplete="off"
								value={amountDisplay}
								oninput={(event) => handleAmountInput(event.currentTarget.value)}
								placeholder="0.00"
								class="w-full rounded-md border border-[#dfdfdf] bg-white py-2 pr-3 pl-7 text-sm text-[#171717] placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
								required
							/>
						</div>
						{#if selectedClientCredit}
							<p class="text-xs text-[#707070]">{helperText}</p>
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
							bind:value={draft.paymentDate}
							class="w-full rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
							required
						/>
					</div>
				</div>

				<div class="space-y-2">
					<p class="text-sm font-medium text-[#171717]">
						Método de pago <span class="text-[#e2005a]">*</span>
					</p>
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
						{#each paymentMethods as method (method.value)}
							<label
								class="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-center transition-colors {draft.paymentMethod ===
								method.value
									? 'border-[#24b47e] bg-[#3ecf8e]/10 text-[#171717]'
									: 'border-[#dfdfdf] text-[#707070] hover:border-[#b2b2b2] hover:bg-[#fafafa]'}"
							>
								<input
									type="radio"
									name="payment_method"
									value={method.value}
									bind:group={draft.paymentMethod}
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
						bind:value={draft.referenceNumber}
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
						bind:value={draft.notes}
						rows="3"
						placeholder="Notas adicionales sobre el pago..."
						class="w-full resize-none rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
					></textarea>
				</div>
			</CardContent>
		</Card>

		<div class="flex items-center justify-end gap-3">
			<Button variant="outline" type="button" onclick={() => onCancel?.()}>Cancelar</Button>
			<Button type="submit" disabled={saving}>
				{#if saving}
					{savingLabel}
				{:else}
					<Save class="mr-2 h-4 w-4" />
					{submitLabel}
				{/if}
			</Button>
		</div>
	</form>
</div>
