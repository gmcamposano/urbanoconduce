<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { 
		ArrowLeft, 
		Printer, 
		Trash2, 
		AlertTriangle, 
		FileText, 
		Mail, 
		Check
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: any } = $props();

	const invoice = $derived(data.invoice);
	const items = $derived(data.items || []);
	
	const profile = $derived(data.profile);
	const canManage = $derived(profile?.role === 'admin' || profile?.role === 'editor');
	const isAdmin = $derived(profile?.role === 'admin');

	let selectedStatus = $state('');
	const currentStatus = $derived(selectedStatus || invoice?.status || '');

	let statusUpdating = $state(false);
	let showDeleteModal = $state(false);
	let deleteLoading = $state(false);

	// Pricing helper calculations (explicit type annotations to prevent implicit any errors)
	const subtotal = $derived(
		items.reduce((sum: number, item: any) => sum + Number(item.amount), 0)
	);
	
	const taxAmount = $derived(
		subtotal * (Number(invoice?.tax_rate || 0) / 100)
	);

	function formatCurrency(val: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
	}

	function handlePrint() {
		window.print();
	}
</script>

<svelte:head>
	<title>{invoice?.invoice_number || 'Factura'} - FacturaFlow</title>
</svelte:head>

{#if invoice}
	<div class="space-y-6 max-w-4xl mx-auto flex-1 flex flex-col justify-start">
		<!-- Actions Top Panel (no-print) -->
		<div class="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-zinc-950/40 p-4 border border-zinc-900 rounded-xl no-print">
			<div class="flex items-center gap-3">
				<a href={resolve('/dashboard')} class="text-zinc-400 hover:text-zinc-200" aria-label="Volver">
					<ArrowLeft class="h-5 w-5" />
				</a>
				<div>
					<h1 class="text-base font-extrabold text-white">{invoice.invoice_number}</h1>
					<p class="text-[10px] text-zinc-500">Creada por {invoice.profiles?.name || 'Desconocido'}</p>
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

			<!-- Management Options -->
			<div class="flex flex-wrap items-center gap-3">
				<!-- Print Button -->
				<Button variant="outline" size="sm" class="flex items-center gap-1.5" onclick={handlePrint}>
					<Printer class="h-4 w-4" />
					Imprimir / guardar PDF
				</Button>

				<!-- Update Status Form (Admins & Editors) -->
				{#if canManage}
					<form 
						action="?/updateStatus" 
						method="POST" 
						class="flex items-center gap-1.5"
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
							class="flex h-8 rounded-lg border border-zinc-805 border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 cursor-pointer"
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
							class="h-8 text-xs px-2.5"
							disabled={selectedStatus === invoice.status || statusUpdating}
						>
							{#if statusUpdating}
							Guardando...
							{:else}
							Actualizar estado
							{/if}
						</Button>
					</form>
				{/if}

				<!-- Delete Button (Admins only) -->
				{#if isAdmin}
					<Button 
						variant="destructive" 
						size="sm" 
						class="flex items-center gap-1.5"
						onclick={() => (showDeleteModal = true)}
					>
						<Trash2 class="h-4 w-4" />
						Eliminar
					</Button>
				{/if}
			</div>
		</div>

		<!-- Error Banner -->
		{#if form?.error}
			<div class="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-sm text-rose-400 flex items-start gap-2.5 shadow-lg shadow-rose-500/5 no-print">
				<AlertTriangle class="h-5 w-5 flex-shrink-0 mt-0.5" />
				<div>
					<p class="font-bold">No se pudo actualizar la factura</p>
					<p class="text-xs text-zinc-400 mt-0.5">{form.error}</p>
				</div>
			</div>
		{/if}

		<!-- Beautiful Invoice Printable Sheet -->
		<Card class="border-zinc-800 bg-zinc-950/20 shadow-2xl relative p-0 overflow-hidden print-card">
			<!-- Watermark glow (no-print) -->
			<div class="absolute top-0 left-0 h-40 w-40 bg-indigo-500/5 blur-[55px] rounded-full pointer-events-none no-print"></div>

			<!-- Clean layout grid (looks like a paper invoice) -->
			<div class="bg-white text-zinc-900 p-8 sm:p-12 min-h-[1000px] flex flex-col justify-between print-card print-text-dark font-sans leading-normal">
				<div class="space-y-12">
					<!-- Header Section -->
					<div class="flex flex-col sm:flex-row justify-between items-start gap-6 border-b pb-8 print-border border-zinc-200">
						<!-- Company Details -->
						<div>
							<div class="flex items-center gap-2 mb-3">
								<div class="bg-indigo-600 p-2 rounded text-white">
									<FileText class="h-5 w-5" />
								</div>
								<span class="font-black text-xl tracking-tight text-zinc-950">FacturaFlow</span>
							</div>
							<p class="text-xs text-zinc-500 font-semibold leading-relaxed">
								FacturaFlow Servicios SRL<br/>
								Avenida Tecnológica 100, Oficina 400<br/>
								Santo Domingo, República Dominicana<br/>
								facturacion@facturaflow.com
							</p>
						</div>

						<!-- Bill statement IDs -->
						<div class="text-left sm:text-right space-y-1.5">
							<h2 class="text-3xl font-extrabold text-zinc-950 tracking-tight uppercase">Factura</h2>
							<p class="text-sm font-bold text-indigo-600 font-mono">{invoice.invoice_number}</p>
							
							<div class="grid grid-cols-2 sm:flex sm:flex-col gap-2 pt-2 text-xs text-zinc-500 font-medium">
								<div>
									<span class="font-bold text-zinc-800 uppercase tracking-wide mr-1">Fecha de emisión:</span>
									<span class="font-mono text-zinc-700">{new Date(invoice.invoice_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>
								</div>
								<div>
									<span class="font-bold text-zinc-800 uppercase tracking-wide mr-1">Fecha de vencimiento:</span>
									<span class="font-mono text-zinc-700">{new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Billing Address / Information Grid -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-8">
						<!-- Client -->
						<div class="space-y-2">
							<h3 class="text-xs font-bold uppercase tracking-wider text-zinc-400">Facturar a:</h3>
							<div class="text-sm text-zinc-800 space-y-1">
								<p class="font-extrabold text-zinc-950 text-base">{invoice.client_name}</p>
								<p class="flex items-center gap-1.5 text-xs text-zinc-600">
									<Mail class="h-3.5 w-3.5 text-zinc-400" />
									{invoice.client_email}
								</p>
							</div>
						</div>

						<!-- Payment Status Indicator -->
						<div class="space-y-2 sm:text-right">
							<h3 class="text-xs font-bold uppercase tracking-wider text-zinc-400">Estado del pago:</h3>
							<div>
								{#if invoice.status === 'paid'}
									<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wider">
										<Check class="h-3.5 w-3.5" />
										Pagada completamente
									</span>
								{:else if invoice.status === 'pending'}
									<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold uppercase tracking-wider">
										Pendiente
									</span>
								{:else if invoice.status === 'overdue'}
									<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold uppercase tracking-wider">
										Vencida
									</span>
								{:else}
									<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 text-xs font-bold uppercase tracking-wider">
										Borrador
									</span>
								{/if}
							</div>
						</div>
					</div>

					<!-- Items Table -->
					<div class="space-y-4">
						<table class="w-full text-sm text-left border-collapse">
							<thead>
								<tr class="border-b-2 print-border border-zinc-900 text-xs uppercase text-zinc-400 font-extrabold tracking-wider">
									<th class="py-3 font-semibold">Descripción</th>
									<th class="py-3 font-semibold text-center w-20">Cant.</th>
									<th class="py-3 font-semibold text-right w-32">Precio unitario</th>
									<th class="py-3 font-semibold text-right w-32">Total</th>
								</tr>
							</thead>
							<tbody class="divide-y print-border divide-zinc-150">
								{#each items as item (item.id ?? item.description)}
									<tr class="text-zinc-800">
										<td class="py-4 font-semibold text-zinc-950">{item.description}</td>
										<td class="py-4 text-center font-mono text-zinc-650">{Number(item.quantity)}</td>
										<td class="py-4 text-right font-mono text-zinc-650">{formatCurrency(Number(item.unit_price))}</td>
										<td class="py-4 text-right font-mono text-zinc-950 font-bold">{formatCurrency(Number(item.amount))}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Summary block -->
					<div class="flex justify-end pt-6">
						<div class="w-full sm:w-80 space-y-3.5 text-sm text-zinc-600">
							<div class="flex justify-between border-b pb-2 print-border border-zinc-150">
								<span class="font-semibold">Subtotal</span>
								<span class="font-mono text-zinc-950 font-bold">{formatCurrency(subtotal)}</span>
							</div>
							<div class="flex justify-between border-b pb-2 print-border border-zinc-150">
								<span class="font-semibold">Impuesto ({invoice.tax_rate}%)</span>
								<span class="font-mono text-zinc-950 font-bold">{formatCurrency(taxAmount)}</span>
							</div>
							<div class="flex justify-between border-b pb-2 print-border border-zinc-150">
								<span class="font-semibold">Descuento</span>
								<span class="font-mono text-zinc-950 font-bold">-{formatCurrency(Number(invoice.discount_amount))}</span>
							</div>
							<div class="flex justify-between text-base font-black text-indigo-650 pt-2 text-indigo-600">
								<span class="uppercase tracking-wide font-extrabold">Total a pagar</span>
								<span class="font-mono text-lg">{formatCurrency(Number(invoice.total_amount))}</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Footer Notes -->
				<div class="border-t print-border border-zinc-200 pt-8 mt-12 space-y-4">
					{#if invoice.notes}
						<div class="space-y-1">
							<h4 class="text-xs font-bold uppercase tracking-wider text-zinc-400">Términos e instrucciones:</h4>
							<p class="text-xs text-zinc-500 leading-relaxed whitespace-pre-line">{invoice.notes}</p>
						</div>
					{/if}
					<div class="text-[10px] text-zinc-450 text-center leading-relaxed">
						Realiza las transferencias bancarias a: <strong>Banco de Reservas</strong>, ruta: <strong>#123456789</strong>, cuenta: <strong>#987654321</strong>.<br/>
						Si tienes preguntas sobre esta factura, escribe a facturacion@facturaflow.com. Gracias por tu confianza.
					</div>
				</div>
			</div>
		</Card>
	</div>
{/if}

<!-- Delete Confirmation Modal (no-print) -->
{#if showDeleteModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm no-print">
		<Card class="w-full max-w-sm border-zinc-800 bg-zinc-950 shadow-2xl">
			<CardContent class="p-6 space-y-4">
				<div class="flex items-center gap-2.5 text-rose-400">
					<AlertTriangle class="h-6 w-6" />
						<h3 class="font-extrabold text-lg">Confirmar eliminación</h3>
				</div>
				
				<p class="text-sm text-zinc-400 leading-relaxed">
						¿Seguro que deseas eliminar la factura <strong class="text-white">{invoice?.invoice_number}</strong>? Esto borrará el registro y todos los conceptos asociados de forma permanente.
				</p>
				
				<div class="flex justify-end gap-3 pt-2">
					<Button 
						variant="outline" 
						size="sm" 
						disabled={deleteLoading}
						onclick={() => (showDeleteModal = false)}
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
								showDeleteModal = false;
								await update();
							};
						}}
					>
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
