<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import SearchableSelect from '$lib/components/ui/SearchableSelect.svelte';
	import {
		ArrowDownToLine,
		Search,
		Package,
		Tags,
		FileSpreadsheet,
		Upload,
		Download,
		FileText,
		AlertCircle
	} from '@lucide/svelte';
	import {
		parseStockEntryFile,
		generateStockEntryTemplate,
		generateStockEntryTemplateCSV,
		type BulkParsedRow
	} from '$lib/inventory/bulk';

	let { data, form } = $props();

	const items = $derived(data.items || []);
	const models = $derived(data.models || []);
	const warehouses = $derived(data.warehouses || []);

	let searchQuery = $state('');
	let selectedWarehouse = $state('');
	let notes = $state('');
	let loading = $state(false);
	let bulkLoading = $state(false);
	let parsedRows: BulkParsedRow[] = $state([]);
	let fileName = $state('');
	let fileError = $state('');

	$effect(() => {
		if (warehouses.length && !selectedWarehouse) {
			const defaultWh = warehouses.find((w) => w.is_default);
			selectedWarehouse = defaultWh?.id || warehouses[0]?.id || '';
		}
	});

	function formatInventoryColor(color: string): string {
		if (!color) return 'Sin color';
		return color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
	}

	function getModelName(modelId: string | null): string {
		if (!modelId) return '—';
		const model = models.find((m) => m.id === modelId);
		return model ? model.model.charAt(0).toUpperCase() + model.model.slice(1).toLowerCase() : '—';
	}

	function capitalize(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
	}

	function formatCurrency(value: number | null): string {
		if (value === null || value === undefined) return '—';
		return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(value);
	}

	async function downloadTemplate(type: 'xlsx' | 'csv') {
		const templateItems = items.map((i) => {
			const model = models.find((m) => m.id === i.model_id);
			return {
				variant_id: i.variant_id,
				product_title: i.product_title,
				model_name: model?.model ?? '',
				color: i.color
			};
		});
		const blob =
			type === 'xlsx'
				? await generateStockEntryTemplate(templateItems)
				: await generateStockEntryTemplateCSV(templateItems);
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `plantilla-entrada-inventario.${type}`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		fileError = '';
		parsedRows = [];
		fileName = '';

		if (!file) return;

		try {
			parsedRows = await parseStockEntryFile(file);
			fileName = file.name;
		} catch (e) {
			fileError = e instanceof Error ? e.message : 'No se pudo leer el archivo.';
		}
	}

	function normalize(value: string): string {
		return value
			.trim()
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '');
	}

	const previewRows = $derived.by(() => {
		const seen: string[] = [];
		return parsedRows.map((row) => {
			const key = `${normalize(row.product)}|${normalize(row.model)}|${normalize(row.color)}`;
			const existing = items.find((i) => {
				const modelName = models.find((m) => m.id === i.model_id)?.model || '';
				return (
					normalize(i.product_title) === normalize(row.product) &&
					normalize(modelName) === normalize(row.model) &&
					normalize(i.color) === normalize(row.color)
				);
			});
			const errors: string[] = [];
			if (row.quantity === null || row.quantity <= 0) {
				errors.push('Cantidad debe ser mayor a cero.');
			}
			if (seen.includes(key)) {
				errors.push('Producto repetido en el archivo.');
			}
			if (row.product.trim() === '' || row.model.trim() === '') {
				errors.push('Producto y modelo son obligatorios.');
			}
			seen.push(key);
			return {
				row,
				existing,
				isNew: !existing,
				errors
			};
		});
	});

	const validBulkRows = $derived(
		previewRows.filter(
			(p) => p.errors.length === 0 && p.row.quantity !== null && p.row.quantity > 0
		)
	);

	const filteredItems = $derived.by(() => {
		if (!searchQuery.trim()) return items;
		const query = searchQuery.toLowerCase().trim();
		return items.filter(
			(i) => i.product_title.toLowerCase().includes(query) || i.color.toLowerCase().includes(query)
		);
	});

	const hasAnyQuantity = $derived(filteredItems.length > 0);
</script>

<svelte:head>
	<title>Entrada de mercancía - magikalInvoice</title>
</svelte:head>

<div class="flex flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<div class="border-b border-[#ededed] pb-5">
		<h1 class="flex items-center gap-2 text-2xl font-medium tracking-tight text-[#171717]">
			<ArrowDownToLine class="h-6 w-6 text-[#3ecf8e]" />
			Entrada de mercancía
		</h1>
		<p class="mt-0.5 text-xs text-[#707070]">
			Registra mercancía recibida. Se registrará como movimiento de tipo "compra". El costo
			ingresado actualiza el precio de compra de la variante.
		</p>
	</div>

	{#if form?.error}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
		>
			<Tags class="mt-0.5 h-5 w-5 shrink-0" />
			<div>
				<p class="font-medium">No se pudo guardar</p>
				<p class="mt-0.5 text-xs text-[#707070]">{form.error}</p>
			</div>
		</div>
	{/if}

	{#if form?.success}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#3ecf8e]/25 bg-[#3ecf8e]/12 p-4 text-sm text-[#171717] shadow-sm"
		>
			<Package class="mt-0.5 h-5 w-5 shrink-0 text-[#24b47e]" />
			<div>
				<p class="font-medium">{form.message}</p>
				<p class="mt-0.5 text-xs text-[#707070]">El inventario se actualizó correctamente.</p>
			</div>
		</div>
	{/if}

	<Card>
		<CardHeader>
			<CardTitle>Configuración</CardTitle>
		</CardHeader>
		<CardContent class="space-y-4">
			<SearchableSelect
				label="Bodega"
				options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
				bind:value={selectedWarehouse}
				placeholder="Selecciona una bodega"
				disabled={warehouses.length === 0}
			/>

			{#if warehouses.length === 0}
				<p class="text-xs text-[#707070]">No hay bodegas configuradas.</p>
			{/if}

			<div class="flex w-full flex-col gap-1.5">
				<label
					for="notes"
					class="text-[11px] font-medium tracking-[0.12em] text-[#707070] uppercase"
					>Notas generales</label
				>
				<textarea
					id="notes"
					bind:value={notes}
					rows="2"
					placeholder="Ej. Factura compra #1234, proveedor X"
					disabled={loading || bulkLoading}
					class="w-full resize-none rounded-md border border-[#dfdfdf] bg-white p-3 text-sm text-[#171717] transition-colors duration-200 placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				></textarea>
			</div>
		</CardContent>
	</Card>

	<form
		action="?/recordStockEntryBulk"
		method="POST"
		class="space-y-6"
		use:enhance={() => {
			bulkLoading = true;
			return async ({ update }) => {
				bulkLoading = false;
				await update();
			};
		}}
	>
		<input type="hidden" name="warehouse_id" value={selectedWarehouse} />
		<input type="hidden" name="notes" value={notes} />
		<input type="hidden" name="entries" value={JSON.stringify(validBulkRows.map((p) => p.row))} />

		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<FileSpreadsheet class="h-5 w-5 text-[#3ecf8e]" />
					Carga desde archivo
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-6">
				<div class="flex flex-col gap-4 sm:flex-row">
					<Button
						type="button"
						variant="outline"
						class="flex-1"
						onclick={() => downloadTemplate('xlsx')}
					>
						<Download class="mr-1.5 h-4 w-4" />
						Descargar plantilla Excel
					</Button>
					<Button
						type="button"
						variant="outline"
						class="flex-1"
						onclick={() => downloadTemplate('csv')}
					>
						<FileText class="mr-1.5 h-4 w-4" />
						Descargar plantilla CSV
					</Button>
				</div>

				<div class="flex w-full flex-col gap-1.5">
					<label
						for="bulk-file"
						class="text-[11px] font-medium tracking-[0.12em] text-[#707070] uppercase"
					>
						Subir archivo Excel o CSV
					</label>
					<input
						id="bulk-file"
						type="file"
						accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
						disabled={bulkLoading}
						onchange={handleFileChange}
						class="block w-full cursor-pointer rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] transition-colors file:mr-4 file:rounded-md file:border-0 file:bg-[#fafafa] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#171717] hover:bg-[#fafafa] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					/>
					{#if fileName}
						<p class="text-xs text-[#707070]">Archivo: {fileName}</p>
					{/if}
					{#if fileError}
						<p class="flex items-center gap-1 text-xs text-[#e2005a]">
							<AlertCircle class="h-3.5 w-3.5" />
							{fileError}
						</p>
					{/if}
				</div>

				{#if parsedRows.length > 0}
					<div class="w-full overflow-x-auto rounded-md border border-[#ededed]">
						<table class="w-full text-left text-sm text-[#171717]">
							<thead
								class="border-b border-[#ededed] bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase"
							>
								<tr>
									<th class="px-4 py-3 font-bold uppercase">Producto</th>
									<th class="px-4 py-3 font-bold uppercase">Modelo</th>
									<th class="px-4 py-3 font-bold uppercase">Color</th>
									<th class="px-4 py-3 text-right font-bold uppercase">Cantidad</th>
									<th class="px-4 py-3 text-right font-bold uppercase">Nuevo costo</th>
									<th class="px-4 py-3 text-right font-bold uppercase">Estado</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-[#ededed]">
								{#each previewRows as preview (preview.row.rowIndex)}
									<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
										<td class="px-4 py-3 font-medium text-[#171717]"
											>{capitalize(preview.row.product)}</td
										>
										<td class="px-4 py-3 text-xs text-[#707070]">{capitalize(preview.row.model)}</td
										>
										<td class="px-4 py-3 text-xs text-[#707070]"
											>{formatInventoryColor(preview.row.color)}</td
										>
										<td class="px-4 py-3 text-right font-mono text-[#171717]"
											>{preview.row.quantity ?? '—'}</td
										>
										<td class="px-4 py-3 text-right font-mono text-xs text-[#707070]">
											{preview.row.newCost !== null ? formatCurrency(preview.row.newCost) : '—'}
										</td>
										<td class="px-4 py-3 text-right">
											{#if preview.errors.length > 0}
												<span
													class="inline-flex items-center rounded-full bg-[#e2005a]/10 px-2 py-1 text-xs font-medium text-[#e2005a]"
												>
													<AlertCircle class="mr-1 h-3 w-3" />
													Error
												</span>
												<div class="mt-1 space-y-0.5">
													{#each preview.errors as err, idx (idx)}
														<p class="text-[10px] text-[#e2005a]">{err}</p>
													{/each}
												</div>
											{:else if preview.isNew}
												<span
													class="inline-flex items-center rounded-full bg-[#3ecf8e]/10 px-2 py-1 text-xs font-medium text-[#24b47e]"
													>Nuevo</span
												>
											{:else}
												<span
													class="inline-flex items-center rounded-full bg-[#ededed] px-2 py-1 text-xs font-medium text-[#707070]"
													>Existente</span
												>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</CardContent>
		</Card>

		<div class="flex justify-end">
			<Button type="submit" disabled={bulkLoading || validBulkRows.length === 0}>
				{#if bulkLoading}
					Guardando...
				{:else}
					<Upload class="mr-1.5 h-4 w-4" />
					Registrar entradas del archivo ({validBulkRows.length})
				{/if}
			</Button>
		</div>
	</form>

	<form
		action="?/recordStockEntry"
		method="POST"
		class="space-y-6"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => {
				loading = false;
				await update();
			};
		}}
	>
		<input type="hidden" name="warehouse_id" value={selectedWarehouse} />
		<input type="hidden" name="notes" value={notes} />

		<Card>
			<CardHeader class="flex flex-row items-center justify-between">
				<CardTitle>Variantes</CardTitle>
				<div class="flex items-center gap-3 rounded-md border border-[#dfdfdf] bg-white px-3 py-2">
					<Search class="h-4 w-4 flex-shrink-0 text-[#707070]" />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Buscar producto o color..."
						class="flex-1 bg-transparent text-sm text-[#171717] outline-none placeholder:text-[#707070]"
					/>
				</div>
			</CardHeader>
			<CardContent class="p-0">
				<div class="w-full overflow-x-auto">
					<table class="w-full text-left text-sm text-[#171717]">
						<thead
							class="border-b border-[#ededed] bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase"
						>
							<tr>
								<th class="px-6 py-4 font-bold uppercase">Producto</th>
								<th class="px-6 py-4 font-bold uppercase">Modelo</th>
								<th class="px-6 py-4 font-bold uppercase">Color</th>
								<th class="px-6 py-4 text-right font-bold uppercase">Stock actual</th>
								<th class="px-6 py-4 text-right font-bold uppercase">Costo actual</th>
								<th class="px-6 py-4 text-right font-bold uppercase">Cantidad</th>
								<th class="px-6 py-4 text-right font-bold uppercase">Nuevo costo (opcional)</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[#ededed]">
							{#if filteredItems.length === 0}
								<tr>
									<td colspan="7" class="px-6 py-12 text-center text-xs text-[#707070]">
										No hay variantes disponibles.
									</td>
								</tr>
							{:else}
								{#each filteredItems as item (item.variant_id)}
									<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
										<td class="px-6 py-4 font-medium text-[#171717]"
											>{capitalize(item.product_title)}</td
										>
										<td class="px-6 py-4 text-xs text-[#707070]">{getModelName(item.model_id)}</td>
										<td class="px-6 py-4 text-xs text-[#707070]"
											>{formatInventoryColor(item.color)}</td
										>
										<td class="px-6 py-4 text-right font-mono text-[#171717]">{item.stock}</td>
										<td class="px-6 py-4 text-right font-mono text-xs text-[#707070]"
											>{formatCurrency(item.purchase_price)}</td
										>
										<td class="px-6 py-4 text-right">
											<input
												type="number"
												name="quantity_{item.variant_id}"
												min="0"
												step="1"
												placeholder="0"
												disabled={loading}
												class="w-24 rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-right text-sm text-[#171717] transition-colors placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
											/>
										</td>
										<td class="px-6 py-4 text-right">
											<input
												type="number"
												name="price_{item.variant_id}"
												min="0"
												step="0.01"
												placeholder="—"
												disabled={loading}
												class="w-28 rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-right text-sm text-[#171717] transition-colors placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
											/>
										</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>

		<div class="flex justify-end">
			<Button type="submit" disabled={loading || !hasAnyQuantity}>
				{#if loading}
					Guardando...
				{:else}
					<ArrowDownToLine class="mr-1.5 h-4 w-4" />
					Registrar entrada
				{/if}
			</Button>
		</div>
	</form>
</div>
