<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import SearchableSelect from '$lib/components/ui/SearchableSelect.svelte';
	import { SvelteDate } from 'svelte/reactivity';
	import { Plus, Trash2, ArrowLeft, Calculator, FileText, Save, DollarSign } from '@lucide/svelte';

	let { data, form } = $props();

	const products = $derived(data.products || []);
	const colors = $derived(data.colors || []);
	const models = $derived(data.models || []);

	function getModelName(modelId: string | null): string {
		if (!modelId) return '-';
		const found = models.find((m) => m.id === modelId);
		return found?.model ?? '-';
	}

	function getAvailableColors(itemId: string): typeof colors {
		const usedColors = items.filter((i) => i.id !== itemId && i.color).map((i) => i.color);
		return colors.filter((c) => !usedColors.includes(c.color));
	}

	function getModelId(productId: string | null): string | null {
		if (!productId) return null;
		const found = clientProducts.find((p) => p.id === productId);
		return found?.model ?? null;
	}

	// Set up date defaults
	const today = new SvelteDate();
	const formattedToday = today.toISOString().split('T')[0];

	const thirtyDaysLater = new SvelteDate(today);
	thirtyDaysLater.setDate(today.getDate() + 30);
	const formattedDue = thirtyDaysLater.toISOString().split('T')[0];

	// Form field reactive states
	let invoiceNumber = $state('');
	let selectedClientId = $state('');

	const clientProducts = $derived(
		selectedClientId
			? products.filter((p) => p.client_id === selectedClientId)
			: []
	);

	let clientEmail = $state('');
	let invoiceDate = $state(formattedToday);
	let dueDate = $state(formattedDue);

	const clients = $derived(data.clients || []);

	const selectedClient = $derived(clients.find((c) => c.id === selectedClientId) || null);

	$effect(() => {
		if (selectedClient) {
			clientEmail = selectedClient.email || '';
		} else {
			clientEmail = '';
		}
		if (selectedClientId) {
			items = items.map((item) => {
				if (item.product_id && !clientProducts.find((p) => p.id === item.product_id)) {
					return { ...item, product_id: '', model: null, unit_price: 0 };
				}
				return item;
			});
		} else {
			items = items.map((item) => ({ ...item, product_id: '', model: null, unit_price: 0 }));
		}
	});

	let notes = $state('');
	let includeTax = $state(false);
	let discountAmount = $state<number>(0);

	// Line items state
	function createItem() {
		return {
			id: crypto.randomUUID(),
			product_id: '',
			color: '',
			model: null as string | null,
			quantity: 1,
			unit_price: 0
		};
	}

	let items = $state<
		Array<{
			id: string;
			product_id: string;
			color: string;
			model: string | null;
			quantity: number;
			unit_price: number;
		}>
	>([createItem()]);

	let loading = $state(false);

	const canAddItem = $derived(!!items[items.length - 1]?.product_id);

	const isFormValid = $derived(
		selectedClientId.trim() !== '' &&
		invoiceNumber.trim() !== '' &&
		items.length > 0 &&
		items.every((item) => item.product_id && item.unit_price > 0)
	);

	$effect(() => {
		if (items.length > 1) {
			const filtered = items.filter((item, index) => index === items.length - 1 || item.product_id);
			if (filtered.length === 0) {
				items = [createItem()];
			} else if (filtered.length < items.length) {
				items = filtered;
			}
		}
	});

	// Subtotal calculations (derived)
	const subtotal = $derived(
		items.reduce(
			(sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
			0
		)
	);

	const taxRate = $derived(includeTax ? 18 : 0);
	const taxAmount = $derived(subtotal * (taxRate / 100));

	const totalAmount = $derived(Math.max(0, subtotal + taxAmount - (Number(discountAmount) || 0)));

	// Helpers to add or remove line items
	function addItem() {
		items.push(createItem());
	}

	function removeItem(id: string) {
		if (items.length > 1) {
			items = items.filter((item) => item.id !== id);
		}
	}

	function applyProductToItem(
		item: { product_id: string; model: string | null; unit_price: number },
		productId: string
	) {
		item.product_id = productId;
		const product = clientProducts.find((entry) => entry.id === productId);
		item.unit_price = Number(product?.price_without_taxes || 0);
		item.model = product?.model ?? null;
	}

	// Formatter helper
	function formatCurrency(val: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
	}
</script>

<svelte:head>
	<title>Nueva factura - FacturaFlow</title>
</svelte:head>

<div class="mx-auto flex max-w-4xl flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<!-- Top back navigation link -->
	<div>
		<a
			href={resolve('/dashboard')}
			class="inline-flex items-center gap-1.5 text-xs font-medium text-[#707070] transition-colors duration-200 hover:text-[#171717]"
		>
			<ArrowLeft class="h-3.5 w-3.5" />
			Volver al panel
		</a>
	</div>

	<!-- Header Title -->
	<div class="border-b border-[#ededed] pb-4">
		<h1 class="flex items-center gap-2 text-2xl font-medium tracking-tight text-[#171717]">
			<FileText class="h-6 w-6 text-[#3ecf8e]" />
			Crear nueva factura
		</h1>
		<p class="mt-0.5 text-xs text-[#707070]">
			Completa los datos del cliente, selecciona productos y ajusta impuestos para emitir la
			factura.
		</p>
	</div>

	<!-- Error Banner -->
	{#if form?.error}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
		>
			<svg
				class="mt-0.5 h-5 w-5 shrink-0 text-[#e2005a]"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
			<div>
				<p class="font-medium">No se pudo publicar la factura</p>
				<p class="mt-0.5 text-xs text-[#707070]">{form.error}</p>
			</div>
		</div>
	{/if}

	<!-- Create Form -->
	<form
		action="?/createInvoice"
		method="POST"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => {
				loading = false;
				await update();
			};
		}}
		class="space-y-6"
	>
		<!-- Serialize items array as a JSON string to submit through standard formData -->
		<input type="hidden" name="items" value={JSON.stringify(items)} />

		<Card>
			<CardHeader>
				<CardTitle>1. Datos principales de la factura</CardTitle>
			</CardHeader>
			<CardContent class="grid grid-cols-1 gap-5 md:grid-cols-3">
				<Input
					label="ID / número de factura"
					name="invoice_number"
					bind:value={invoiceNumber}
					placeholder={data.invoiceNumberPreview || 'INV-2026-0001'}
					disabled={loading}
				/>

				<input type="hidden" name="status" value="pending" />

				<Select
					label="Cliente"
					name="client_id"
					bind:value={selectedClientId}
					disabled={loading}
					required
				>
					<option value="">Selecciona un cliente</option>
					{#each clients as client (client.id)}
						<option value={client.id}>
							{client.client_type === 'company'
								? client.company_name || client.alias || 'Empresa sin nombre'
								: client.full_name || 'Cliente sin nombre'}
						</option>
					{/each}
				</Select>

				<input
					type="hidden"
					name="client_name"
					value={selectedClient
						? selectedClient.client_type === 'company'
							? selectedClient.company_name || selectedClient.alias || ''
							: selectedClient.full_name || ''
						: ''}
				/>

				<Input
					label="Correo del cliente"
					name="client_email"
					type="email"
					bind:value={clientEmail}
					placeholder="Se autocompleta al seleccionar cliente"
					readonly
					disabled={loading}
				/>

				<Input
					label="Fecha de emisión"
					name="invoice_date"
					type="date"
					bind:value={invoiceDate}
					required
					disabled={loading}
				/>

				<Input
					label="Fecha de vencimiento"
					name="due_date"
					type="date"
					bind:value={dueDate}
					required
					disabled={loading}
				/>
			</CardContent>
		</Card>

		<!-- Line Items Card -->
		<Card>
			<CardHeader class="flex flex-row items-center justify-between">
				<CardTitle>2. Conceptos de cobro</CardTitle>
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="flex items-center gap-1"
					onclick={addItem}
					disabled={loading || !canAddItem}
				>
					<Plus class="h-3.5 w-3.5" />
					Añadir fila
				</Button>
			</CardHeader>
			<CardContent class="p-0">
				{#if !selectedClientId}
					<div class="border-b border-[#ededed] bg-[#fafafa] px-3 py-3 text-xs text-[#707070]">
						Selecciona un cliente primero para ver sus productos.
					</div>
				{:else if !clientProducts.length}
					<div class="border-b border-[#ededed] bg-[#fafafa] px-3 py-3 text-xs text-[#707070]">
						Este cliente no tiene productos. Crea al menos uno en la sección Productos.
					</div>
				{/if}
				{#if !colors.length}
					<div class="border-b border-[#ededed] bg-[#fafafa] px-3 py-3 text-xs text-[#707070]">
						No hay colores disponibles. Crea al menos uno en la sección Colores.
					</div>
				{/if}
				<div class="w-full overflow-x-auto">
					<table class="w-full table-fixed text-left text-xs text-[#171717]">
						<thead
							class="border-b border-[#ededed] bg-[#fafafa] tracking-wider text-[#707070] uppercase"
						>
							<tr>
								<th class="w-1/4 px-3 py-2.5 font-semibold">Producto</th>
								<th class="w-1/4 px-3 py-2.5 font-semibold">Modelo</th>
								<th class="w-1/5 px-3 py-2.5 font-semibold">Color</th>
								<th class="w-24 px-3 py-2.5 text-center font-semibold">Cant.</th>
								<th class="w-32 px-3 py-2.5 text-right font-semibold">Precio unit.</th>
								<th class="w-1/6 px-3 py-2.5 text-right font-semibold">Total</th>
								<th class="w-8 px-3 py-2.5"></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[#ededed]">
							{#each items as item (item.id)}
								<tr class="hover:bg-[#fafafa]">
									<td class="px-3 py-2">
										<SearchableSelect
											options={clientProducts.map((p) => ({ value: p.id, label: p.title }))}
											bind:value={item.product_id}
											placeholder={selectedClientId ? 'Selecciona' : 'Primero elige un cliente'}
											disabled={loading || !selectedClientId || !clientProducts.length}
											onchange={(value) => applyProductToItem(item, value)}
										/>
									</td>
									<td class="px-3 py-2">
										<input
											type="text"
											readonly
											value={item.product_id ? getModelName(item.model) : '-'}
											class="h-9 w-full rounded-md border border-[#dfdfdf] bg-[#fafafa] px-3 py-2 text-xs text-[#707070] capitalize read-only:cursor-not-allowed"
										/>
									</td>
									<td class="px-3 py-2">
										<Select
											label=""
											name="color"
											bind:value={item.color}
											disabled={loading || getAvailableColors(item.id).length === 0}
											required={getAvailableColors(item.id).length > 0}
											class="text-xs capitalize"
										>
											<option value="">Color</option>
											{#if getAvailableColors(item.id).length === 0}
												<option value="" disabled>No hay colores</option>
											{/if}
											{#each getAvailableColors(item.id) as color (color.id)}
												<option value={color.color}>{color.color}</option>
											{/each}
										</Select>
									</td>
									<td class="px-3 py-2">
										<input
											type="number"
											required
											min="1"
											step="any"
											bind:value={item.quantity}
											disabled={loading}
											class="h-9 w-full rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-center font-mono text-sm text-[#171717] focus-visible:ring-1 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
										/>
									</td>
									<td class="px-3 py-2">
										<div class="relative">
											<span
												class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-mono text-sm text-[#707070]"
												>RD$</span
											>
											<input
												type="number"
												required
												min="0"
												step="any"
												bind:value={item.unit_price}
												readonly
												disabled={loading}
												class="h-9 w-full rounded-md border border-[#dfdfdf] bg-white py-2 pr-3 pl-10 text-right font-mono text-sm text-[#171717] focus-visible:ring-1 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
											/>
										</div>
									</td>
									<td class="px-3 py-2">
										<div class="flex h-9 items-center justify-end px-3">
											<span class="font-mono text-sm text-[#707070]">
												{formatCurrency(
													(Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
												)}
											</span>
										</div>
									</td>
									<td class="px-3 py-2">
										<div class="flex h-9 items-center justify-end">
											<Button
												type="button"
												variant="ghost"
												size="icon"
												class="h-9 w-9 text-[#707070] hover:text-[#e2005a]"
												disabled={items.length <= 1 || loading}
												onclick={() => removeItem(item.id)}
											>
												<Trash2 class="h-4 w-4" />
											</Button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>

		<!-- Bottom Calculation / Settings Grid -->
		<div class="grid grid-cols-1 gap-5 md:grid-cols-2">
			<!-- Notes Card -->
			<Card>
				<CardHeader>
					<CardTitle>3. Términos y notas</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="flex flex-col gap-1.5">
						<label
							for="notes"
							class="text-[11px] font-medium tracking-[0.12em] text-[#707070] uppercase"
							>Términos / notas de la factura</label
						>
						<textarea
							id="notes"
							name="notes"
							rows="4"
							bind:value={notes}
							placeholder="Gracias por su preferencia. El pago vence en 30 días mediante transferencia bancaria."
							disabled={loading}
							class="w-full resize-none rounded-md border border-[#dfdfdf] bg-white p-3 text-sm text-[#171717] transition-colors duration-200 placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
						></textarea>
					</div>
				</CardContent>
			</Card>

			<!-- Summary Pricing Card -->
			<Card class="relative overflow-hidden">
				<div
					class="pointer-events-none absolute top-0 right-0 h-32 w-32 rounded-full bg-[#3ecf8e]/10 blur-[50px]"
				></div>
				<CardHeader>
					<CardTitle class="flex items-center gap-1.5">
						<Calculator class="h-4.5 w-4.5 text-[#24b47e]" />
						Resumen y totales
					</CardTitle>
				</CardHeader>
				<CardContent class="space-y-4">
					<!-- Tax & Discount inputs -->
					<div class="grid grid-cols-1 gap-4 border-b border-[#ededed] pb-4 md:grid-cols-2">
						<label
							class="flex items-center gap-3 rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717]"
						>
							<input
								type="checkbox"
								name="include_tax"
								value="true"
								bind:checked={includeTax}
								disabled={loading}
								class="h-4 w-4 rounded border-[#c7c7c7] accent-[#3ecf8e]"
							/>
							<span class="text-sm font-medium">Incluir impuesto 18%</span>
						</label>

						<Input
							label="Descuento ($)"
							name="discount_amount"
							type="number"
							min="0"
							step="any"
							bind:value={discountAmount}
							disabled={loading}
						/>
					</div>

					<!-- Pricing breakdown details -->
					<div class="space-y-2 text-sm text-[#707070]">
						<div class="flex justify-between">
							<span>Subtotal</span>
							<span class="font-mono font-medium text-[#171717]">{formatCurrency(subtotal)}</span>
						</div>
						<div class="flex justify-between">
							<span>Impuesto ({taxRate}%)</span>
							<span class="font-mono font-medium text-[#171717]">{formatCurrency(taxAmount)}</span>
						</div>
						<div class="flex justify-between">
							<span>Descuento</span>
							<span class="font-mono font-medium text-[#171717]"
								>-{formatCurrency(discountAmount || 0)}</span
							>
						</div>

						<div class="flex justify-between border-t border-[#ededed] pt-2 text-base font-medium">
							<span class="flex items-center gap-1 text-[#24b47e]">
								<DollarSign class="h-4.5 w-4.5" />
								Total a pagar
							</span>
							<span class="font-mono text-[#171717]">{formatCurrency(totalAmount)}</span>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>

		<!-- Submit Buttons -->
		<div class="flex justify-end gap-3 border-t border-[#ededed] pt-6">
			<a href={resolve('/dashboard')}>
				<Button variant="outline" disabled={loading}>Cancelar</Button>
			</a>

			<Button type="submit" disabled={loading || !isFormValid} class="flex items-center gap-1.5">
				{#if loading}
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-[#171717]/20 border-t-[#171717]"
					></div>
					Guardando factura...
				{:else}
					<Save class="h-4 w-4" />
					Guardar factura
				{/if}
			</Button>
		</div>
	</form>
</div>
