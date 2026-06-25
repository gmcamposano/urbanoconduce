<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import {
		ArrowLeft,
		Calendar,
		User,
		Receipt,
		Wallet,
		FileText,
		Trash2,
		Printer,
		AlertTriangle,
		Banknote,
		CreditCard,
		Building2
	} from '@lucide/svelte';

	let { data, form } = $props();

	const payment = $derived(data.payment);
	const isAdmin = $derived(data.profile?.role === 'admin');
	const allocations = $derived(payment.allocations || []);

	let showDeleteConfirm = $state(false);
	let deleting = $state(false);

	const getClientDisplay = (payment: {
		clients?: { client_type: string; full_name: string; company_name?: string | null } | null;
	}) => {
		const c = payment.clients;
		if (!c) return 'Cliente';
		return c.client_type === 'company' ? c.company_name || c.full_name : c.full_name;
	};

	const getMethodIcon = (method: string) => {
		switch (method) {
			case 'cash':
				return Banknote;
			case 'transfer':
				return Building2;
			case 'card':
				return CreditCard;
			default:
				return Wallet;
		}
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

	const formatCurrency = (val: number) => {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
	};

	const MethodIcon = $derived(getMethodIcon(payment.payment_method));
</script>

<svelte:head>
	<title>Detalle de Pago - magikalInvoice</title>
</svelte:head>

<div class="flex flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<div class="flex items-center justify-between">
		<a
			href={resolve('/dashboard/accounting')}
			class="flex items-center gap-2 text-sm text-[#707070] transition-colors hover:text-[#171717]"
		>
			<ArrowLeft class="h-4 w-4" />
			Volver a contabilidad
		</a>

		<div class="flex items-center gap-2">
			<Button variant="outline" onclick={() => window.print()}>
				<Printer class="mr-2 h-4 w-4" />
				Imprimir
			</Button>

			{#if isAdmin}
				<Button variant="outline" onclick={() => (showDeleteConfirm = true)}>
					<Trash2 class="mr-2 h-4 w-4" />
					Eliminar
				</Button>
			{/if}
		</div>
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

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="space-y-6 lg:col-span-2">
			<Card class="bg-white">
				<CardHeader>
					<CardTitle>Información del pago</CardTitle>
				</CardHeader>
				<CardContent class="space-y-4">
					<div class="grid grid-cols-2 gap-6">
						<div class="space-y-1">
							<p class="text-xs font-medium tracking-wider text-[#707070] uppercase">Monto</p>
							<p class="font-mono text-2xl font-medium text-[#24b47e]">
								{formatCurrency(Number(payment.amount))}
							</p>
						</div>

						<div class="space-y-1">
							<p class="text-xs font-medium tracking-wider text-[#707070] uppercase">Método</p>
							<div class="flex items-center gap-2">
								<MethodIcon class="h-5 w-5 text-[#707070]" />
								<p class="font-medium">{getMethodLabel(payment.payment_method)}</p>
							</div>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-6">
						<div class="space-y-1">
							<p class="text-xs font-medium tracking-wider text-[#707070] uppercase">
								Fecha de pago
							</p>
							<div class="flex items-center gap-2">
								<Calendar class="h-4 w-4 text-[#9a9a9a]" />
								<p class="font-medium">
									{new Date(payment.payment_date).toLocaleDateString('en-US', {
										weekday: 'long',
										year: 'numeric',
										month: 'long',
										day: 'numeric',
										timeZone: 'UTC'
									})}
								</p>
							</div>
						</div>

						{#if payment.reference_number}
							<div class="space-y-1">
								<p class="text-xs font-medium tracking-wider text-[#707070] uppercase">
									Referencia
								</p>
								<p class="font-medium">{payment.reference_number}</p>
							</div>
						{/if}
					</div>

					{#if payment.notes}
						<div class="space-y-1">
							<p class="text-xs font-medium tracking-wider text-[#707070] uppercase">Notas</p>
							<p class="text-sm text-[#707070]">{payment.notes}</p>
						</div>
					{/if}
				</CardContent>
			</Card>

			<Card class="bg-white">
				<CardHeader>
					<CardTitle>Detalles</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="space-y-4">
						<div class="flex items-center gap-3">
							<div class="rounded-md border border-[#ededed] bg-[#fafafa] p-2">
								<User class="h-5 w-5 text-[#707070]" />
							</div>
							<div>
								<p class="text-xs text-[#707070]">Cliente</p>
								<p class="font-medium">{getClientDisplay(payment)}</p>
							</div>
						</div>

						<div class="space-y-2">
							<p class="text-xs text-[#707070]">Aplicado a</p>
							{#if allocations.length > 0}
								<div class="space-y-2">
									{#each allocations as allocation (allocation.id)}
										<div
											class="flex items-center justify-between gap-3 rounded-lg border border-[#ededed] bg-[#fafafa] p-3"
										>
											<div class="min-w-0">
												<a
													href={resolve(
														allocation.factura_tipo === 'proforma'
															? '/dashboard/proforma/[id]'
															: '/dashboard/invoices/[id]',
														{ id: allocation.invoice_id }
													)}
													class="truncate font-medium text-[#24b47e] hover:underline"
												>
													{allocation.invoice_number}
												</a>
												<p class="text-xs text-[#707070]">
													{formatCurrency(allocation.invoice_total_amount)} total · {new Date(
														allocation.invoice_date
													).toLocaleDateString('en-US', {
														month: 'short',
														day: 'numeric',
														year: 'numeric',
														timeZone: 'UTC'
													})}
												</p>
											</div>
											<p class="font-mono text-sm font-medium text-[#171717]">
												{formatCurrency(allocation.applied_amount)}
											</p>
										</div>
									{/each}
								</div>
							{:else}
								<div class="flex items-center gap-3">
									<div class="rounded-md border border-[#ededed] bg-[#fafafa] p-2">
										<Receipt class="h-5 w-5 text-[#707070]" />
									</div>
									<div>
										<p class="text-xs text-[#707070]">Factura asociada</p>
										<p class="font-medium text-[#9a9a9a]">Sin factura específica</p>
									</div>
								</div>
							{/if}
						</div>

						<div class="flex items-center gap-3">
							<div class="rounded-md border border-[#ededed] bg-[#fafafa] p-2">
								<FileText class="h-5 w-5 text-[#707070]" />
							</div>
							<div>
								<p class="text-xs text-[#707070]">Registrado por</p>
								<p class="font-medium">{payment.profiles?.name || 'Usuario'}</p>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>

		<div class="lg:col-span-1">
			<Card class="bg-white">
				<CardHeader>
					<CardTitle>Resumen</CardTitle>
				</CardHeader>
				<CardContent class="space-y-3">
					<div class="flex items-center justify-between border-b border-[#ededed] py-2">
						<span class="text-sm text-[#707070]">Monto pagado</span>
						<span class="font-mono font-medium text-[#24b47e]"
							>{formatCurrency(Number(payment.amount))}</span
						>
					</div>
					<div class="flex items-center justify-between border-b border-[#ededed] py-2">
						<span class="text-sm text-[#707070]">Fecha</span>
						<span class="text-sm font-medium"
							>{new Date(payment.payment_date).toLocaleDateString('en-US', {
								timeZone: 'UTC'
							})}</span
						>
					</div>
					<div class="flex items-center justify-between border-b border-[#ededed] py-2">
						<span class="text-sm text-[#707070]">Método</span>
						<Badge variant="secondary">{getMethodLabel(payment.payment_method)}</Badge>
					</div>
					<div class="flex items-center justify-between py-2">
						<span class="text-sm text-[#707070]">Registrado</span>
						<span class="text-xs text-[#707070]">
							{new Date(payment.created_at).toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric',
								year: 'numeric',
								timeZone: 'UTC'
							})}
						</span>
					</div>
				</CardContent>
			</Card>
		</div>
	</div>
</div>

{#if showDeleteConfirm}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
		<Card class="w-full max-w-sm">
			<CardContent class="space-y-4 p-6">
				<div class="flex items-center gap-2.5 text-[#e2005a]">
					<AlertTriangle class="h-6 w-6" />
					<h3 class="text-lg font-medium">Confirmar eliminación</h3>
				</div>

				<p class="text-sm leading-relaxed text-[#707070]">
					¿Seguro que deseas eliminar este pago de <strong class="text-[#171717]"
						>{getClientDisplay(payment)}</strong
					>? Esta acción es permanente y no se puede deshacer.
				</p>

				<div class="flex justify-end gap-3 pt-2">
					<Button
						variant="outline"
						size="sm"
						disabled={deleting}
						onclick={() => (showDeleteConfirm = false)}
					>
						Cancelar
					</Button>

					<form
						action="?/deletePayment"
						method="POST"
						use:enhance={() => {
							deleting = true;
							return async ({ update }) => {
								deleting = false;
								showDeleteConfirm = false;
								await update();
							};
						}}
					>
						<Button type="submit" variant="destructive" size="sm" disabled={deleting}>
							{#if deleting}
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
