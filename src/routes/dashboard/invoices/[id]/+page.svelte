<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import {
		ArrowLeft,
		Edit3,
		Printer,
		Download,
		Trash2,
		AlertTriangle,
		FileText,
		Mail,
		Check
	} from '@lucide/svelte';
	import html2pdf from 'html2pdf.js';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const invoice = $derived(data.invoice);
	const items = $derived(data.items || []);
	const products = $derived(data.products || []);
	const models = $derived(data.models || []);

	const profile = $derived(data.profile);
	const isAdmin = $derived(profile?.role === 'admin');

	function getModelName(modelId: string | null): string {
		if (!modelId) return '-';
		const found = models.find((m) => m.id === modelId);
		return found?.model ?? '-';
	}

	const sortedItems = $derived(
		[...items].sort((a, b) => {
			const modelA = getModelName(a.model).toLowerCase();
			const modelB = getModelName(b.model).toLowerCase();
			if (modelA === '-') return 1;
			if (modelB === '-') return -1;
			return modelA.localeCompare(modelB);
		})
	);

	function getProductModel(productId: string | null): string | null {
		if (!productId) return null;
		const found = products.find((p) => p.id === productId);
		return found?.model ?? null;
	}

	let selectedStatus = $state('');
	const currentStatus = $derived(selectedStatus || invoice?.status || '');

	let statusUpdating = $state(false);
	let showDeleteModal = $state(false);
	let deleteLoading = $state(false);
	let confirmText = $state('');

	// Pricing helper calculations (explicit type annotations to prevent implicit any errors)
	const subtotal = $derived(
		items.reduce((sum: number, item: { amount: number | string }) => sum + Number(item.amount), 0)
	);

	const taxAmount = $derived(subtotal * (Number(invoice?.tax_rate || 0) / 100));

	function formatCurrency(val: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
	}

	function handlePrint() {
		window.print();
	}

	function handleDownloadPdf() {
		const element = document.getElementById('invoice-printable');
		if (!element) return;
		const opt = {
			margin: 0.5,
			filename: `${invoice?.invoice_number || 'invoice'}.pdf`,
			image: { type: 'jpeg', quality: 0.98 },
			html2canvas: { scale: 2 },
			jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
		};
		html2pdf().set(opt).from(element).save();
	}
</script>

<style>
	@media print {
		.no-print {
			display: none !important;
		}
		.print-card {
			box-shadow: none !important;
			border: none !important;
		}
	}
</style>

<svelte:head>
	<title>{invoice?.invoice_number || 'Factura'} - magikalInvoice</title>
</svelte:head>

{#if invoice}
	<div class="flex flex-1 flex-col justify-start space-y-6 px-4 text-[#171717] sm:px-6">
		<!-- Actions Top Panel (no-print) -->
		<div class="no-print rounded-lg border border-[#dfdfdf] bg-white p-4 sm:p-5">
			<!-- Top Row: Back + Invoice Info + Badge -->
			<div class="mb-4 flex items-center justify-between gap-4">
				<div class="flex items-center gap-4">
					<a
						href={resolve('/dashboard')}
						class="flex h-9 w-9 items-center justify-center rounded-md border border-[#dfdfdf] text-[#707070] transition-colors hover:bg-[#fafafa] hover:text-[#171717]"
						aria-label="Volver"
					>
						<ArrowLeft class="h-4 w-4" />
					</a>
					<div>
						<h1 class="text-base font-medium text-[#171717]">{invoice.invoice_number}</h1>
						<p class="text-[10px] text-[#707070]">
							Creada por {invoice.profiles?.name || 'Desconocido'}
						</p>
					</div>
				</div>
				<!-- Current Status Badge -->
				{#if invoice.status === 'paid'}
					<Badge variant="success">Pagada</Badge>
				{:else if invoice.status === 'pending'}
					<Badge variant="warning">Pendiente</Badge>
				{:else if invoice.status === 'overdue'}
					<Badge variant="danger">Vencida</Badge>
				{:else}
					<Badge variant="secondary">Borrador</Badge>
				{/if}
			</div>

			<!-- Divider -->
			<div class="mb-4 border-t border-[#ededed]"></div>

			<!-- Bottom Row: Actions -->
			<div class="flex flex-wrap items-center gap-2 sm:gap-3">
				<!-- Print Button -->
				<Button variant="outline" size="sm" class="flex items-center gap-1.5" onclick={handlePrint}>
					<Printer class="h-4 w-4" />
					<span class="hidden sm:inline">Imprimir</span>
					<span class="sm:hidden">Imprimir</span>
				</Button>

				<!-- Download PDF Button -->
				<Button variant="outline" size="sm" class="flex items-center gap-1.5" onclick={handleDownloadPdf}>
					<Download class="h-4 w-4" />
					<span class="hidden sm:inline">Descargar PDF</span>
					<span class="sm:hidden">PDF</span>
				</Button>

				<!-- Update Status Form (Admins only) -->
				{#if isAdmin}
					<form
						action="?/updateStatus"
						method="POST"
						class="flex items-center gap-2"
						use:enhance={() => {
							statusUpdating = true;
							return async ({ update }) => {
								statusUpdating = false;
								await update();
							};
						}}
					>
						<select
							name="status"
							value={currentStatus}
							onchange={(event) => {
								selectedStatus = event.currentTarget.value;
							}}
							disabled={statusUpdating}
							class="h-8 min-w-30 cursor-pointer rounded-md border border-[#dfdfdf] bg-white px-3 text-xs text-[#171717] focus-visible:ring-1 focus-visible:ring-[#3ecf8e] focus-visible:outline-none"
						>
							<option value="draft">Borrador</option>
							<option value="pending">Pendiente</option>
							<option value="paid">Pagada</option>
							<option value="overdue">Vencida</option>
						</select>
						<Button
							type="submit"
							variant="secondary"
							size="sm"
							class="h-8 px-2.5 text-xs"
							disabled={selectedStatus === invoice.status || statusUpdating}
						>
							{#if statusUpdating}
								Guardando...
							{:else}
								Actualizar
							{/if}
						</Button>
					</form>
				{/if}

				{#if isAdmin}
					<a href={resolve(`/dashboard/invoices/${invoice.id}/edit`)}>
						<Button variant="outline" size="sm" class="flex items-center gap-1.5">
							<Edit3 class="h-4 w-4" />
							<span class="hidden sm:inline">Editar factura</span>
							<span class="sm:hidden">Editar</span>
						</Button>
					</a>

					<Button
						variant="destructive"
						size="sm"
						class="flex items-center gap-1.5"
						onclick={() => (showDeleteModal = true)}
					>
						<Trash2 class="h-4 w-4" />
						<span class="hidden sm:inline">Eliminar</span>
					</Button>
				{/if}
			</div>
		</div>

		<!-- Error Banner -->
		{#if form?.error}
			<div
				class="no-print flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
			>
				<AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" />
				<div>
					<p class="font-bold">No se pudo procesar la factura</p>
					<p class="mt-0.5 text-xs text-[#707070]">{form.error}</p>
				</div>
			</div>
		{/if}

		<!-- Beautiful Invoice Printable Sheet -->
		<Card id="invoice-printable" class="print-card relative overflow-hidden p-0">
			<!-- Watermark glow (no-print) -->
			<div
				class="no-print pointer-events-none absolute top-0 left-0 h-40 w-40 rounded-full bg-[#3ecf8e]/10 blur-[55px]"
			></div>

			<!-- Clean layout grid (looks like a paper invoice) -->
			<div
				class="print-card print-text-dark flex min-h-250 flex-col justify-between bg-white p-8 pb-4 font-sans leading-normal text-[#171717] sm:p-12 sm:pb-6"
			>
				<div class="space-y-12">
					<!-- Header Section -->
					<div
						class="print-border flex flex-col items-start justify-between gap-6 border-b border-[#ededed] pb-8 sm:flex-row"
					>
						<!-- Company Details -->
						<div>
							<div class="mb-3 flex items-center gap-2">
								<div class="rounded-md border border-[#24b47e] bg-[#3ecf8e] p-2 text-[#171717]">
									<FileText class="h-5 w-5" />
								</div>
								<span class="text-xl font-medium tracking-tight text-[#171717]">MagikalConduce</span
								>
							</div>
							<p class="text-xs leading-relaxed font-medium text-[#707070]">
								Xtracto SRL<br />
								131758495<br />
								Santo Domingo, República Dominicana<br />
							</p>
						</div>

						<!-- Bill statement IDs -->
						<div class="space-y-1.5 text-left sm:text-right">
							<h2 class="text-3xl font-medium tracking-tight text-[#171717] uppercase">Factura</h2>
							<p class="font-mono text-sm font-medium text-[#24b47e]">{invoice.invoice_number}</p>

							<div
								class="grid grid-cols-2 gap-2 pt-2 text-xs font-medium text-[#707070] sm:flex sm:flex-col"
							>
								<div>
									<span class="mr-1 font-medium tracking-wide text-[#171717] uppercase"
										>Fecha de emisión:</span
									>
									<span class="font-mono text-[#707070]"
										>{new Date(invoice.invoice_date).toLocaleDateString('en-US', {
											month: 'long',
											day: 'numeric',
											year: 'numeric',
											timeZone: 'UTC'
										})}</span
									>
								</div>
								<div>
									<span class="mr-1 font-medium tracking-wide text-[#171717] uppercase"
										>Fecha de vencimiento:</span
									>
									<span class="font-mono text-[#707070]"
										>{new Date(invoice.due_date).toLocaleDateString('en-US', {
											month: 'long',
											day: 'numeric',
											year: 'numeric',
											timeZone: 'UTC'
										})}</span
									>
								</div>
							</div>
						</div>
					</div>

					<!-- Billing Address / Information Grid -->
					<div class="grid grid-cols-1 gap-8 sm:grid-cols-2">
						<!-- Client -->
						<div class="space-y-2">
							<h3 class="text-xs font-medium tracking-wider text-[#707070] uppercase">
								Facturar a:
							</h3>
							<div class="space-y-1 text-sm text-[#171717]">
								<p class="text-base font-medium capitalize text-[#171717]">{invoice.client_name}</p>
								{#if invoice.clients?.client_type === 'company' && invoice.clients?.rnc}
									<p class="text-xs text-[#707070]">RNC: {invoice.clients.rnc}</p>
								{/if}
								<p class="flex items-center gap-1.5 text-xs text-[#707070]">
									<Mail class="h-3.5 w-3.5 text-[#9a9a9a]" />
									{invoice.client_email}
								</p>
							</div>
						</div>

						<!-- Payment Status Indicator -->
						<div class="space-y-2 sm:text-right">
							<h3 class="text-xs font-medium tracking-wider text-[#707070] uppercase">
								Estado del pago:
							</h3>
							<div>
								{#if invoice.status === 'paid'}
									<span
										class="inline-flex items-center gap-1.5 rounded border border-[#3ecf8e]/25 bg-[#3ecf8e]/12 px-3 py-1 text-xs font-medium tracking-wider text-[#171717] uppercase"
									>
										<Check class="h-3.5 w-3.5" />
										Pagada completamente
									</span>
								{:else if invoice.status === 'pending'}
									<span
										class="inline-flex items-center gap-1.5 rounded border border-[#ffdb13]/35 bg-[#ffdb13]/20 px-3 py-1 text-xs font-medium tracking-wider text-[#171717] uppercase"
									>
										Pendiente
									</span>
								{:else if invoice.status === 'overdue'}
									<span
										class="inline-flex items-center gap-1.5 rounded border border-[#e2005a]/20 bg-[#e2005a]/10 px-3 py-1 text-xs font-medium tracking-wider text-[#e2005a] uppercase"
									>
										Vencida
									</span>
								{:else}
									<span
										class="inline-flex items-center gap-1.5 rounded border border-[#dfdfdf] bg-[#fafafa] px-3 py-1 text-xs font-medium tracking-wider text-[#171717] uppercase"
									>
										Borrador
									</span>
								{/if}
							</div>
						</div>
					</div>

					<!-- Items Table -->
					<div class="space-y-4">
						<table class="w-full border-collapse text-left text-sm">
							<thead>
								<tr
									class="print-border border-b-2 border-[#171717] text-xs font-medium tracking-wider text-[#707070] uppercase"
								>
									<th class="py-3 font-semibold">Descripción</th>
									<th class="py-3 font-semibold">Modelo</th>
									<th class="py-3 font-semibold">Color</th>
									<th class="w-20 py-3 text-center font-semibold">Cant.</th>
									<th class="w-32 py-3 text-right font-semibold">Precio unitario</th>
									<th class="w-32 py-3 text-right font-semibold">Total</th>
								</tr>
							</thead>
							<tbody class="print-border divide-y divide-[#ededed]">
								{#each sortedItems as item (item.id ?? item.description)}
									{@const productModel = item.model ? getModelName(item.model) : '-'}
									<tr class="text-[#171717]">
										<td class="py-4">
											<p class="font-medium capitalize text-[#171717]">{item.description}</p>
										</td>
										<td class="py-4 capitalize text-[#707070]">
											{productModel}
										</td>
										<td class="py-4">
											{#if item.color}
												<Badge variant="outline" class="capitalize">{item.color}</Badge>
											{:else}
												<span class="text-[#9a9a9a]">-</span>
											{/if}
										</td>
										<td class="py-4 text-center font-mono text-[#707070]"
											>{Number(item.quantity)}</td
										>
										<td class="py-4 text-right font-mono text-[#707070]"
											>RD$ {formatCurrency(Number(item.unit_price))}</td
										>
										<td class="py-4 text-right font-mono font-medium text-[#171717]"
											>{formatCurrency(Number(item.amount))}</td
										>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Summary block -->
					<div class="flex justify-end pt-6">
						<div class="w-full space-y-1 text-sm text-[#707070] sm:w-80">
							<div class="print-border flex justify-between border-b border-[#ededed] pb-2">
								<span class="font-medium">Subtotal</span>
								<span class="font-mono font-medium text-[#171717]">{formatCurrency(subtotal)}</span>
							</div>
							<div class="print-border flex justify-between border-b border-[#ededed] pb-2">
								<span class="font-medium">Impuesto ({invoice.tax_rate}%)</span>
								<span class="font-mono font-medium text-[#171717]">{formatCurrency(taxAmount)}</span
								>
							</div>
							<div class="print-border flex justify-between border-b border-[#ededed] pb-2">
								<span class="font-medium">Descuento</span>
								<span class="font-mono font-medium text-[#171717]"
									>-{formatCurrency(Number(invoice.discount_amount))}</span
								>
							</div>
							<div class="flex justify-between pt-2 text-base font-medium text-[#24b47e]">
								<span class="tracking-wide uppercase">Total a pagar</span>
								<span class="font-mono text-lg text-[#171717]"
									>{formatCurrency(Number(invoice.total_amount))}</span
								>
							</div>
						</div>
					</div>
				</div>

				<!-- Footer Notes -->
				<div class="print-border mt-4 space-y-2 border-t border-[#ededed] pt-4">
					{#if invoice.notes}
						<div class="space-y-1">
							<h4 class="text-xs font-medium tracking-wider text-[#707070] uppercase">
								Términos e instrucciones:
							</h4>
							<p class="text-xs leading-relaxed whitespace-pre-line text-[#707070]">
								{invoice.notes}
							</p>
						</div>
					{/if}
					<div class="py-1 text-center text-[10px] leading-relaxed text-[#707070]">
						Gracias por tu confianza.
					</div>
				</div>
			</div>
		</Card>
	</div>
{/if}

<!-- Delete Confirmation Modal (no-print) -->
{#if showDeleteModal}
	<div
		class="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
	>
		<Card class="w-full max-w-sm">
			<CardContent class="space-y-4 p-6">
				<div class="flex items-center gap-2.5 text-[#e2005a]">
					<AlertTriangle class="h-6 w-6" />
					<h3 class="text-lg font-medium">Confirmar eliminación</h3>
				</div>

				<p class="text-sm leading-relaxed text-[#707070]">
					¿Seguro que deseas eliminar la factura <strong class="text-[#171717]"
						>{invoice?.invoice_number}</strong
					>? Esto borrará el registro y todos los conceptos asociados de forma permanente.
				</p>

				<div class="space-y-2">
					<label for="confirmDelete" class="text-xs font-medium text-[#707070]">
						Escribe <strong class="text-[#171717]">{invoice?.invoice_number}</strong> para confirmar
					</label>
					<input
						id="confirmDelete"
						type="text"
						bind:value={confirmText}
						placeholder={invoice?.invoice_number}
						class="w-full rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] placeholder:text-[#9a9a9a] focus-visible:border-[#e2005a] focus-visible:ring-1 focus-visible:ring-[#e2005a]/30 focus-visible:outline-none"
					/>
				</div>

				<div class="flex justify-end gap-3 pt-2">
					<Button
						variant="outline"
						size="sm"
						disabled={deleteLoading}
						onclick={() => {
							showDeleteModal = false;
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
							return async ({ update }) => {
								deleteLoading = false;
								showDeleteModal = false;
								confirmText = '';
								await update();
							};
						}}
					>
						<Button
							type="submit"
							variant="destructive"
							size="sm"
							disabled={deleteLoading || confirmText !== invoice?.invoice_number}
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
