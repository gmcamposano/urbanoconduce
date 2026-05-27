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
	import { SvelteDate } from 'svelte/reactivity';
	import { 
		Plus, 
		Trash2, 
		ArrowLeft, 
		Calculator, 
		FileText,
		Save,
		DollarSign
	} from '@lucide/svelte';

	let { data, form } = $props();

	// Set up date defaults
	const today = new SvelteDate();
	const formattedToday = today.toISOString().split('T')[0];
	
	const thirtyDaysLater = new SvelteDate(today);
	thirtyDaysLater.setDate(today.getDate() + 30);
	const formattedDue = thirtyDaysLater.toISOString().split('T')[0];

	// Form field reactive states
	let invoiceNumber = $state('');
	let clientName = $state('');
	let clientEmail = $state('');
	let invoiceDate = $state(formattedToday);
	let dueDate = $state(formattedDue);
	let status = $state<'draft' | 'pending'>('pending');
	let notes = $state('');
	let taxRate = $state<number>(0);
	let discountAmount = $state<number>(0);

	// Line items state
	let items = $state<Array<{ id: string; description: string; quantity: number; unit_price: number }>>([
		{ id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0 }
	]);

	let loading = $state(false);

	// Subtotal calculations (derived)
	const subtotal = $derived(
		items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0)
	);
	
	const taxAmount = $derived(
		subtotal * ((Number(taxRate) || 0) / 100)
	);

	const totalAmount = $derived(
		Math.max(0, subtotal + taxAmount - (Number(discountAmount) || 0))
	);

	// Helpers to add or remove line items
	function addItem() {
		items.push({ id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0 });
	}

	function removeItem(id: string) {
		if (items.length > 1) {
			items = items.filter((item) => item.id !== id);
		}
	}

	// Formatter helper
	function formatCurrency(val: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
	}
</script>

<svelte:head>
	<title>Nueva factura - FacturaFlow</title>
</svelte:head>

<div class="space-y-6 max-w-4xl mx-auto flex-1 flex flex-col justify-start text-[#171717]">
	<!-- Top back navigation link -->
	<div>
		<a href={resolve('/dashboard')} class="inline-flex items-center gap-1.5 text-xs text-[#707070] hover:text-[#171717] font-medium transition-colors duration-200">
			<ArrowLeft class="h-3.5 w-3.5" />
			Volver al panel
		</a>
	</div>

	<!-- Header Title -->
	<div class="border-b border-[#ededed] pb-4">
		<h1 class="text-2xl font-medium text-[#171717] tracking-tight flex items-center gap-2">
			<FileText class="h-6 w-6 text-[#3ecf8e]" />
			Crear nueva factura
		</h1>
		<p class="text-[#707070] text-xs mt-0.5">Completa los datos del cliente, los conceptos y los impuestos para emitir la factura.</p>
	</div>

	<!-- Error Banner -->
	{#if form?.error}
		<div class="bg-[#e2005a]/10 border border-[#e2005a]/20 p-4 rounded-xl text-sm text-[#e2005a] flex items-start gap-2.5 shadow-sm">
			<svg class="h-5 w-5 text-[#e2005a] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
			<div>
				<p class="font-medium">No se pudo publicar la factura</p>
				<p class="text-xs text-[#707070] mt-0.5">{form.error}</p>
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
			<CardContent class="grid grid-cols-1 md:grid-cols-3 gap-5">
				<Input
					label="ID / número de factura"
					name="invoice_number"
					bind:value={invoiceNumber}
					placeholder={data.invoiceNumberPreview || 'INV-2026-0001'}
					required
					disabled={loading}
				/>
				
				<Select
					label="Estado"
					name="status"
					bind:value={status}
					required
					disabled={loading}
				>
						<option value="pending">Pendiente de aprobación</option>
						<option value="draft">Borrador (sin enviar)</option>
				</Select>

				<Input
					label="Nombre del cliente"
					name="client_name"
					bind:value={clientName}
					placeholder="Constructora del Caribe SRL"
					required
					disabled={loading}
				/>

				<Input
					label="Correo del cliente"
					name="client_email"
					type="email"
					bind:value={clientEmail}
					placeholder="facturacion@cliente.com"
					required
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
			<CardHeader class="flex flex-row justify-between items-center">
				<CardTitle>2. Conceptos de cobro</CardTitle>
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="flex items-center gap-1"
					onclick={addItem}
					disabled={loading}
				>
					<Plus class="h-3.5 w-3.5" />
					Añadir fila
				</Button>
			</CardHeader>
			<CardContent class="p-0">
				<div class="overflow-x-auto w-full">
			<table class="w-full text-sm text-left text-[#171717]">
				<thead class="text-xs uppercase bg-[#fafafa] text-[#707070] border-b border-[#ededed] tracking-wider">
							<tr>
								<th class="px-6 py-3 font-semibold w-1/2">Descripción</th>
								<th class="px-6 py-3 font-semibold w-1/6">Cant.</th>
								<th class="px-6 py-3 font-semibold w-1/6">Precio unitario</th>
								<th class="px-6 py-3 font-semibold w-1/6">Total</th>
								<th class="px-6 py-3 font-semibold text-right w-10"></th>
							</tr>
						</thead>
				<tbody class="divide-y divide-[#ededed]">
							{#each items as item (item.id)}
							<tr class="hover:bg-[#fafafa]">
									<td class="px-6 py-3">
										<input
											type="text"
											required
												placeholder="Descripción del concepto (ej. asesoría web)"
											bind:value={item.description}
											disabled={loading}
							class="w-full bg-white border border-[#dfdfdf] rounded-[6px] px-2.5 py-1.5 text-xs text-[#171717] placeholder:text-[#9a9a9a] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3ecf8e]/35"
						/>
									</td>
									<td class="px-6 py-3">
										<input
											type="number"
											required
											min="1"
											step="any"
											bind:value={item.quantity}
											disabled={loading}
							class="w-full bg-white border border-[#dfdfdf] rounded-[6px] px-2.5 py-1.5 text-xs text-[#171717] text-center font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3ecf8e]/35"
						/>
									</td>
									<td class="px-6 py-3">
										<input
											type="number"
											required
											min="0"
											step="any"
											bind:value={item.unit_price}
											disabled={loading}
							class="w-full bg-white border border-[#dfdfdf] rounded-[6px] px-2.5 py-1.5 text-xs text-[#171717] text-right font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3ecf8e]/35"
						/>
									</td>
								<td class="px-6 py-3 text-right font-mono text-[#707070] text-xs">
										{formatCurrency((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}
									</td>
									<td class="px-6 py-3 text-right">
										<Button
											type="button"
											variant="ghost"
											size="icon"
							class="h-7 w-7 text-[#707070] hover:text-[#e2005a]"
											disabled={items.length <= 1 || loading}
											onclick={() => removeItem(item.id)}
										>
											<Trash2 class="h-3.5 w-3.5" />
										</Button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>

		<!-- Bottom Calculation / Settings Grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
			<!-- Notes Card -->
			<Card>
				<CardHeader>
				<CardTitle>3. Términos y notas</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="flex flex-col gap-1.5">
				<label for="notes" class="text-[11px] font-medium uppercase tracking-[0.12em] text-[#707070]">Términos / notas de la factura</label>
						<textarea
							id="notes"
							name="notes"
							rows="4"
							bind:value={notes}
							placeholder="Gracias por su preferencia. El pago vence en 30 días mediante transferencia bancaria."
							disabled={loading}
					class="w-full bg-white border border-[#dfdfdf] rounded-[6px] p-3 text-sm text-[#171717] placeholder:text-[#9a9a9a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:border-[#24b47e] resize-none transition-colors duration-200"
						></textarea>
					</div>
				</CardContent>
			</Card>

			<!-- Summary Pricing Card -->
			<Card class="relative overflow-hidden">
				<div class="absolute top-0 right-0 h-32 w-32 bg-[#3ecf8e]/10 blur-[50px] rounded-full pointer-events-none"></div>
				<CardHeader>
					<CardTitle class="flex items-center gap-1.5">
					<Calculator class="h-4.5 w-4.5 text-[#24b47e]" />
							Resumen y totales
					</CardTitle>
				</CardHeader>
				<CardContent class="space-y-4">
					<!-- Tax & Discount inputs -->
				<div class="grid grid-cols-2 gap-4 border-b border-[#ededed] pb-4">
						<Input
							label="Impuesto (%)"
							name="tax_rate"
							type="number"
							min="0"
							step="any"
							bind:value={taxRate}
							disabled={loading}
						/>
						
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
							<span class="font-mono text-[#171717] font-medium">{formatCurrency(subtotal)}</span>
						</div>
						<div class="flex justify-between">
							<span>Impuesto ({taxRate || 0}%)</span>
							<span class="font-mono text-[#171717] font-medium">{formatCurrency(taxAmount)}</span>
						</div>
						<div class="flex justify-between">
							<span>Descuento</span>
							<span class="font-mono text-[#171717] font-medium">-{formatCurrency(discountAmount || 0)}</span>
						</div>
						
						<div class="flex justify-between text-base font-medium pt-2 border-t border-[#ededed]">
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
				<Button variant="outline" disabled={loading}>
							Cancelar
				</Button>
			</a>
			
			<Button
				type="submit"
				disabled={loading}
				class="flex items-center gap-1.5"
			>
				{#if loading}
						<div class="h-4 w-4 border-2 border-[#171717]/20 border-t-[#171717] rounded-full animate-spin"></div>
							Guardando factura...
				{:else}
					<Save class="h-4 w-4" />
							Guardar factura
				{/if}
			</Button>
		</div>
	</form>
</div>
