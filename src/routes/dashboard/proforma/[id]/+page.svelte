<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import {
		ArrowLeft,
		Edit3,
		Printer,
		Download,
		Trash2,
		AlertTriangle,
		FileText,
		Check
	} from '@lucide/svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const invoice = $derived(data.invoice);
	const items = $derived(data.items || []);
	const paymentBreakdown = $derived(data.paymentBreakdown || []);
	// const products = $derived(data.products || []);
	const models = $derived(data.models || []);

	const profile = $derived(data.profile);
	const canManage = $derived(profile?.role === 'admin' || profile?.role === 'editor');
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

	// function getProductModel(productId: string | null): string | null {
	// 	if (!productId) return null;
	// 	const found = products.find((p) => p.id === productId);
	// 	return found?.model ?? null;
	// }

	let selectedStatus = $state('');
	const currentStatus = $derived(selectedStatus || invoice?.status || '');

	let statusUpdating = $state(false);
	let showDeleteModal = $state(false);
	let deleteLoading = $state(false);
	let confirmText = $state('');

	type CollectionState = 'draft' | 'pending' | 'partial' | 'paid' | 'overdue';

	// Pricing helper calculations (explicit type annotations to prevent implicit any errors)
	const totalQuantity = $derived(
		items.reduce(
			(sum: number, item: { quantity: number | string }) => sum + Number(item.quantity),
			0
		)
	);

	const subtotal = $derived(
		items.reduce((sum: number, item: { amount: number | string }) => sum + Number(item.amount), 0)
	);

	const taxRate = $derived(Number(invoice?.tax_rate || 0));
	const taxAmount = $derived(subtotal * (taxRate / 100));
	const discountAmount = $derived(Number(invoice?.discount_amount || 0));
	const showDiscount = $derived(discountAmount > 0);
	const collectionState = $derived(
		invoice ? getCollectionState(invoice) : ('draft' as CollectionState)
	);

	function itemTotalWithTax(amount: number): number {
		return amount * (1 + taxRate / 100);
	}

	function getCollectionState(source: {
		status: string;
		paidAmount?: number;
		balanceDue?: number;
		total_amount: number | string;
	}) {
		const paidAmount = Number(source.paidAmount || 0);
		const balanceDue = Number(source.balanceDue || 0);
		const totalAmount = Number(source.total_amount || 0);

		if (totalAmount > 0 && balanceDue <= 0) return 'paid' satisfies CollectionState;
		if (paidAmount > 0) return 'partial' satisfies CollectionState;
		if (source.status === 'overdue') return 'overdue' satisfies CollectionState;
		if (source.status === 'pending') return 'pending' satisfies CollectionState;
		return 'draft' satisfies CollectionState;
	}

	function getCollectionLabel(state: CollectionState) {
		switch (state) {
			case 'paid':
				return 'Saldada';
			case 'partial':
				return 'Abonada parcialmente';
			case 'overdue':
				return 'Vencida';
			case 'pending':
				return 'Pendiente';
			default:
				return 'Borrador';
		}
	}

	function getCollectionClass(state: CollectionState) {
		switch (state) {
			case 'paid':
				return 'text-[#24b47e]';
			case 'partial':
				return 'text-[#0f766e]';
			case 'overdue':
				return 'text-[#e2005a]';
			case 'pending':
				return 'text-[#ca8a04]';
			default:
				return 'text-[#707070]';
		}
	}

	function formatCurrency(val: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
	}

	function getMethodLabel(method: string) {
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
	}

	function inlineLoadedStyles(clonedDoc: Document) {
		const style = clonedDoc.createElement('style');
		const cssText = Array.from(document.styleSheets)
			.map((sheet) => {
				try {
					return Array.from(sheet.cssRules)
						.map((rule) => rule.cssText)
						.join('\n');
				} catch {
					return '';
				}
			})
			.filter(Boolean)
			.join('\n');

		style.textContent = cssText;
		clonedDoc.head.appendChild(style);
		clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => link.remove());
	}

	function handlePrint() {
		window.print();
	}

	async function handleDownloadPdf() {
		try {
			const html2pdf = (await import('html2pdf.js')).default;
			const element = document.getElementById('invoice-printable');
			if (!element) return;

			const opt = {
				margin: 0.5,
				filename: `${invoice?.invoice_number || 'invoice'}.pdf`,
				image: { type: 'jpeg' as const, quality: 0.98 },
				pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as const },
				html2canvas: {
					scale: 2,
					useCORS: true,
					logging: false,
					onclone: (clonedDoc: Document) => {
						inlineLoadedStyles(clonedDoc);
						const breakStyle = clonedDoc.createElement('style');
						breakStyle.textContent = `
							#invoice-printable p,
							#invoice-printable tr,
							#invoice-printable li {
								break-inside: avoid;
								page-break-inside: avoid;
							}
						`;
						clonedDoc.head.appendChild(breakStyle);
						clonedDoc.documentElement.style.fontSize = '90%';
						clonedDoc.body.style.fontSize = '90%';
						clonedDoc.querySelectorAll<HTMLElement>('.print-card').forEach((card: HTMLElement) => {
							const printableCard = card as HTMLElement;
							printableCard.style.border = 'none';
							printableCard.style.boxShadow = 'none';
							printableCard.style.borderRadius = '0';
						});
						clonedDoc
							.querySelectorAll<HTMLElement>('.print-badge-label')
							.forEach((label: HTMLElement) => {
								const statusLabel = label as HTMLElement;
								statusLabel.style.display = 'inline-block';
								statusLabel.style.lineHeight = '1';
								statusLabel.style.transform = 'translateY(-4px)';
							});
						clonedDoc
							.querySelectorAll<HTMLElement>('.print-badge span')
							.forEach((badge: HTMLElement) => {
								const statusBadge = badge as HTMLElement;
								statusBadge.style.border = 'none';
								statusBadge.style.boxShadow = 'none';
							});
					}
				},
				jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const }
			};
			await html2pdf().set(opt).from(element).save();
		} catch (err) {
			console.error('PDF generation failed:', err);
			alert("PDF generation failed. Please use your browser's Print > Save as PDF instead.");
		}
	}
</script>

<svelte:head>
	<title>{invoice?.invoice_number || 'Proforma'} - magikalInvoice</title>
</svelte:head>

{#if invoice}
	<div class="flex flex-1 flex-col justify-start space-y-6 px-4 text-[#171717] sm:px-6">
		<!-- Actions Top Panel (no-print) -->
		<div class="no-print rounded-lg border border-[#dfdfdf] bg-white p-4 sm:p-5">
			<!-- Top Row: Back + Invoice Info + Badge -->
			<div class="mb-4 flex items-center justify-between gap-4">
				<div class="flex items-center gap-4">
					<a
						href={resolve('/dashboard/proforma')}
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
				<span class="text-xs font-medium {getCollectionClass(collectionState)}">
					{getCollectionLabel(collectionState)}
				</span>
			</div>

			<!-- Divider -->
			<div class="mb-4 border-t border-[#ededed]"></div>

			<!-- Bottom Row: Actions -->
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				{#if isAdmin}
					<form
						action="?/updateStatus"
						method="POST"
						class="flex flex-wrap items-center gap-2 pb-3 sm:border-r sm:border-[#ededed] sm:pr-4 sm:pb-0"
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
							<option value="overdue">Vencida</option>
							{#if invoice.status === 'paid'}
								<option value="paid" disabled>Saldada automaticamente</option>
							{/if}
						</select>
						<Button
							type="submit"
							variant="default"
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

				<div class="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3 sm:pl-4">
					<!-- Print Button -->
					<Button
						variant="outline"
						size="sm"
						class="flex items-center gap-1.5"
						onclick={handlePrint}
					>
						<Printer class="h-4 w-4" />
						<span class="hidden sm:inline">Imprimir</span>
						<span class="sm:hidden">Imprimir</span>
					</Button>

					<!-- Download PDF Button -->
					<Button
						variant="outline"
						size="sm"
						class="flex items-center gap-1.5"
						onclick={handleDownloadPdf}
					>
						<Download class="h-4 w-4" />
						<span class="hidden sm:inline">Guardar PDF</span>
						<span class="sm:hidden">PDF</span>
					</Button>

					{#if canManage}
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

					{#if canManage}
						<a href={resolve(`/dashboard/proforma/${invoice.id}/edit`)}>
							<Button variant="outline" size="sm" class="flex items-center gap-1.5">
								<Edit3 class="h-4 w-4" />
								<span class="hidden sm:inline">Editar proforma</span>
								<span class="sm:hidden">Editar</span>
							</Button>
						</a>
					{/if}
				</div>
			</div>
		</div>

		<!-- Error Banner -->
		{#if form?.error}
			<div
				class="no-print flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
			>
				<AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" />
				<div>
					<p class="font-bold">No se pudo procesar la proforma</p>
					<p class="mt-0.5 text-xs text-[#707070]">{form.error}</p>
				</div>
			</div>
		{/if}

		<!-- Beautiful Invoice Printable Sheet -->
		<Card id="invoice-printable" class="print-card relative overflow-hidden p-0">
			<!-- Watermark glow (no-print) -->
			<!-- <div
				class="no-print pointer-events-none absolute top-0 left-0 h-40 w-40 rounded-full bg-[#3ecf8e]/10 blur-[55px]"
			></div> -->

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
								<span class="text-xl font-medium tracking-tight text-[#171717]">magikalInvoice</span
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
							<h2 class="text-3xl font-medium tracking-tight text-[#171717] uppercase">
								{invoice.factura_tipo === 'proforma'
									? 'PROFORMA'
									: invoice.factura_tipo === 'valor_fiscal'
										? 'FACTURA VALOR FISCAL'
										: 'FACTURA COMERCIAL'}
							</h2>
							{#if invoice.factura_tipo === 'valor_fiscal' && invoice.ncf}
								<p class="font-mono text-sm font-medium text-[#24b47e]">NCF: {invoice.ncf}</p>
							{/if}
							<p class="font-mono text-sm font-medium text-[#24b47e]">{invoice.invoice_number}</p>

							<div
								class="grid grid-cols-2 gap-2 pt-2 text-xs font-medium text-[#707070] sm:flex sm:flex-col"
							>
								<div>
									<span class="mr-1 font-medium tracking-wide text-[#171717] uppercase"
										>Fecha de emisión:</span
									>
									<span class="font-mono text-[#707070]"
										>{new Date(invoice.invoice_date).toLocaleDateString('es-ES', {
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
										>{new Date(invoice.due_date).toLocaleDateString('es-ES', {
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
								<p class="text-base font-medium text-[#171717] capitalize">{invoice.client_name}</p>
								{#if invoice.clients?.client_type === 'company' && invoice.clients?.rnc}
									<p class="text-xs text-[#707070]">RNC: {invoice.clients.rnc}</p>
								{/if}
								<p class="flex items-center gap-1.5 text-xs text-[#707070]">
									<!-- <Mail class="h-3.5 w-3.5 text-[#9a9a9a]" /> -->
									{invoice.client_email}
								</p>
							</div>
						</div>

						<!-- Payment Status Indicator -->
						<div class="flex flex-col items-end justify-center space-y-2 sm:text-right">
							<h3 class="text-xs leading-4 font-medium tracking-wider text-[#707070] uppercase">
								Estado del pago:
							</h3>
							<div class="print-badge">
								{#if collectionState === 'paid'}
									<span
										class="inline-flex h-7 items-center justify-center gap-1.5 rounded border px-3 py-0 text-xs font-medium tracking-wider uppercase"
										style="background-color: #dcfce7; border: 1px solid #86efac; color: #171717;"
									>
										<Check class="h-3.5 w-3.5" />
										<span class="print-badge-label">Saldada</span>
									</span>
								{:else if collectionState === 'partial'}
									<span
										class="inline-flex h-7 items-center justify-center rounded border px-3 py-0 text-xs font-medium tracking-wider uppercase"
										style="background-color: #ccfbf1; border: 1px solid #5eead4; color: #115e59;"
									>
										<span class="print-badge-label">Abonada parcialmente</span>
									</span>
								{:else if collectionState === 'pending'}
									<span
										class="inline-flex h-7 items-center justify-center rounded border px-3 py-0 text-xs font-medium tracking-wider uppercase"
										style="background-color: #fef9c3; border: 1px solid #fde047; color: #171717;"
									>
										<span class="print-badge-label">Pendiente</span>
									</span>
								{:else if invoice.status === 'overdue'}
									<span
										class="inline-flex h-7 items-center justify-center rounded border px-3 py-0 text-xs font-medium tracking-wider uppercase"
										style="background-color: #fce7f3; border: 1px solid #f9a8d4; color: #be185d;"
									>
										<span class="print-badge-label">Vencida</span>
									</span>
								{:else}
									<span
										class="inline-flex h-7 items-center justify-center rounded border px-3 py-0 text-xs font-medium tracking-wider uppercase"
										style="background-color: #fafafa; border: 1px solid #e5e5e5; color: #171717;"
									>
										<span class="print-badge-label">Borrador</span>
									</span>
								{/if}
							</div>
							<div class="grid w-full max-w-sm grid-cols-3 gap-3 pt-2 text-left sm:text-right">
								<div>
									<p class="text-[10px] tracking-wider text-[#707070] uppercase">Total</p>
									<p class="font-mono text-sm font-medium text-[#171717]">
										{formatCurrency(Number(invoice.total_amount || 0))}
									</p>
								</div>
								<div>
									<p class="text-[10px] tracking-wider text-[#707070] uppercase">Abonado</p>
									<p class="font-mono text-sm font-medium text-[#24b47e]">
										{formatCurrency(Number(invoice.paidAmount || 0))}
									</p>
								</div>
								<div>
									<p class="text-[10px] tracking-wider text-[#707070] uppercase">Restante</p>
									<p class="font-mono text-sm font-medium text-[#171717]">
										{formatCurrency(Number(invoice.balanceDue || 0))}
									</p>
								</div>
							</div>
						</div>
					</div>

					<!-- Items Table -->
					<div class="space-y-4">
						<table class="w-full table-fixed border-collapse text-left text-sm">
							<thead>
								<tr
									class="print-border border-b-2 border-[#171717] text-xs font-medium tracking-wider text-[#707070] uppercase"
								>
									<th class="w-[30%] px-3 py-3 align-middle font-semibold">Descripción</th>
									<th class="w-[13%] px-3 py-3 text-left align-middle font-semibold">Modelo</th>
									<th class="w-[13%] px-3 py-3 text-left align-middle font-semibold">Color</th>
									<th
										class="w-[8%] px-3 py-3 text-center align-middle font-semibold whitespace-nowrap"
										>Cant.</th
									>
									<th
										class="w-[14%] px-3 py-3 text-right align-middle font-semibold whitespace-nowrap"
										>Precio unitario</th
									>
									<th
										class="w-[10%] px-3 py-3 text-right align-middle font-semibold whitespace-nowrap"
										>Total</th
									>
									<th
										class="w-[12%] px-3 py-3 text-right align-middle font-semibold whitespace-nowrap"
										>Total/Imp</th
									>
								</tr>
							</thead>
							<tbody class="print-border divide-y divide-[#ededed]">
								{#each sortedItems as item (item.id ?? item.description)}
									{@const productModel = item.model ? getModelName(item.model) : '-'}
									<tr class="text-[#171717]">
										<td class="px-3 py-2.5 align-middle">
											<p class="font-medium break-words text-[#171717] capitalize">
												{item.description}
											</p>
										</td>
										<td class="px-3 py-2.5 text-left align-middle text-[#707070] capitalize">
											{productModel}
										</td>
										<td class="px-3 py-2.5 text-left align-middle">
											{#if item.color}
												<span class="text-xs font-medium text-[#707070] capitalize">
													{item.color}
												</span>
											{:else}
												<span class="text-[#9a9a9a]">-</span>
											{/if}
										</td>
										<td class="px-3 py-2.5 text-center align-middle font-mono text-[#707070]"
											>{Number(item.quantity)}</td
										>
										<td class="px-3 py-2.5 text-right align-middle font-mono text-[#707070]"
											>RD$ {formatCurrency(Number(item.unit_price))}</td
										>
										<td
											class="px-3 py-2.5 text-right align-middle font-mono font-medium text-[#171717]"
											>{formatCurrency(Number(item.amount))}</td
										>
										<td
											class="px-3 py-2.5 text-right align-middle font-mono font-medium text-[#171717]"
											>{formatCurrency(itemTotalWithTax(Number(item.amount)))}</td
										>
									</tr>
								{/each}
							</tbody>
							<tfoot>
								<tr class="border-t-2 border-[#171717] font-medium text-[#171717]">
									<td colspan="3" class="px-3 py-2.5 text-right align-middle text-sm"
										>Cantidad de artículos</td
									>
									<td class="px-3 py-2.5 text-center align-middle font-mono">{totalQuantity}</td>
									<td colspan="3" class="px-3 py-2.5"></td>
								</tr>
							</tfoot>
						</table>
					</div>

					<!-- Summary block -->
					<div class="flex justify-end pt-6">
						<div class="w-full space-y-0.5 text-sm text-[#707070] sm:w-80">
							<div class="print-border flex justify-between border-b border-[#ededed] pb-1.5">
								<span class="font-medium">Subtotal</span>
								<span class="font-mono font-medium text-[#171717]">{formatCurrency(subtotal)}</span>
							</div>
							<div class="print-border flex justify-between border-b border-[#ededed] pb-1.5">
								<span class="font-medium">Impuesto ({invoice.tax_rate}%)</span>
								<span class="font-mono font-medium text-[#171717]">{formatCurrency(taxAmount)}</span
								>
							</div>
							{#if showDiscount}
								<div class="print-border flex justify-between border-b border-[#ededed] pb-1.5">
									<span class="font-medium">Descuento</span>
									<span class="font-mono font-medium text-[#171717]"
										>-{formatCurrency(discountAmount)}</span
									>
								</div>
							{/if}
							<div class="flex justify-between pt-1.5 text-base font-medium text-[#24b47e]">
								<span class="tracking-wide uppercase">Total a pagar</span>
								<span class="font-mono text-lg text-[#171717]"
									>{formatCurrency(Number(invoice.total_amount))}</span
								>
							</div>
						</div>
					</div>

					<div class="space-y-4 pt-8">
						<div
							class="flex flex-col gap-1 border-t border-[#ededed] pt-6 sm:flex-row sm:items-end sm:justify-between"
						>
							<div>
								<h3 class="text-sm font-medium tracking-wide text-[#171717] uppercase">
									Historial de abonos
								</h3>
								<p class="text-xs text-[#707070]">
									Detalle de adelantos registrados para esta proforma.
								</p>
							</div>
							<p class="text-xs text-[#707070]">
								{paymentBreakdown.length} movimiento(s)
							</p>
						</div>

						{#if paymentBreakdown.length === 0}
							<div
								class="rounded-lg border border-[#ededed] bg-[#fafafa] px-4 py-5 text-sm text-[#707070]"
							>
								No hay abonos registrados todavia.
							</div>
						{:else}
							<div
								class="divide-y divide-[#ededed] overflow-hidden rounded-lg border border-[#ededed] bg-[#fafafa]"
							>
								{#each paymentBreakdown as payment (payment.id)}
									<div
										class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
									>
										<div class="min-w-0 space-y-1">
											<p class="text-sm font-medium text-[#171717]">
												{new Date(payment.payment_date || payment.created_at).toLocaleDateString(
													'es-ES',
													{
														month: 'long',
														day: 'numeric',
														year: 'numeric',
														timeZone: 'UTC'
													}
												)}
											</p>
											<p class="text-xs tracking-wider text-[#707070] uppercase">
												{getMethodLabel(payment.payment_method || '')}
												{#if payment.reference_number}
													· Ref. {payment.reference_number}
												{/if}
											</p>
											{#if payment.notes}
												<p class="text-xs text-[#707070]">{payment.notes}</p>
											{/if}
											<div class="flex flex-wrap items-center gap-3 text-[11px] text-[#707070]">
												<a
													href={resolve(`/dashboard/accounting/${payment.payment_id}`)}
													class="font-medium text-[#24b47e] hover:underline"
												>
													Ver pago
												</a>
												{#if payment.created_by_name}
													<span>Registrado por {payment.created_by_name}</span>
												{/if}
											</div>
										</div>
										<p class="font-mono text-sm font-medium text-[#24b47e]">
											{formatCurrency(Number(payment.applied_amount || 0))}
										</p>
									</div>
								{/each}
							</div>
						{/if}
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
					¿Seguro que deseas eliminar la proforma <strong class="text-[#171717]"
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

<style>
	@media print {
		:global(html) {
			font-size: 75%;
		}

		.no-print {
			display: none !important;
		}
		.print-card {
			box-shadow: none !important;
			border: none !important;
		}
		.print-card p,
		.print-card tr {
			break-inside: avoid;
			page-break-inside: avoid;
		}
		.print-badge span {
			print-color-adjust: exact;
			-webkit-print-color-adjust: exact;
		}
	}
</style>
