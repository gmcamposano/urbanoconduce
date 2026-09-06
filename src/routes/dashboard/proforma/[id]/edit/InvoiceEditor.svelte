<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { SvelteMap } from 'svelte/reactivity';
	import { fly } from 'svelte/transition';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import SearchableSelect from '$lib/components/ui/SearchableSelect.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import {
		AlertTriangle,
		ArrowLeft,
		Calculator,
		Copy,
		DollarSign,
		FileText,
		Plus,
		RefreshCw,
		Save,
		Trash2,
		Zap,
		ArrowUp,
		ArrowDown,
		ArrowUpDown,
		History,
		Palette
	} from '@lucide/svelte';
	import QuickAddDialog from '$lib/components/QuickAddDialog.svelte';
	import ProformaCsvImport from '$lib/components/ProformaCsvImport.svelte';
	import type { CsvImportRow } from '$lib/proformaCsv';
	import {
		nextSortState,
		sortProformaItems,
		type ProformaSortKey,
		type ProformaSortState
	} from '$lib/proformaSort';
	import type { InvoiceEditorData } from '$lib/invoiceEditor';
	import type { ActionData } from './$types';

	type InvoiceFormItem = {
		id: string;
		product_id: string;
		color: string;
		model: string | null;
		quantity: number;
		unit_price: number;
	};

	type EditorState = {
		invoiceNumber: string;
		facturaTipo: string;
		ncf: string;
		selectedClientId: string;
		clientName: string;
		clientEmail: string;
		invoiceDate: string;
		dueDate: string;
		status: 'draft' | 'pending' | 'paid' | 'overdue';
		notes: string;
		includeTax: boolean;
		discountAmount: number;
		items: InvoiceFormItem[];
	};

	type TaxMode = 'none' | 'included' | 'added';
	type MissingVariant = {
		productId: string;
		productTitle: string;
		color: string;
	};

	type ProductOption = InvoiceEditorData['products'][number];
	type ClientOption = {
		id: string;
		client_type: string;
		full_name: string | null;
		company_name: string | null;
		alias: string | null;
		email: string | null;
	};

	let {
		invoice,
		products,
		colors,
		models,
		clients,
		clientPrices,
		initial,
		form: actionForm,
		isAdmin
	}: Pick<InvoiceEditorData, 'invoice' | 'products' | 'colors' | 'models'> & {
		clients: ClientOption[];
		clientPrices: { product_id: string; client_id: string; unit_price: number }[];
		initial: EditorState;
		form: ActionData;
		isAdmin?: boolean;
	} = $props();

	function createEditorState(source: EditorState): EditorState {
		return {
			...source,
			items: source.items.map((item) => ({ ...item }))
		};
	}

	let editor = $state<EditorState>({
		invoiceNumber: '',
		facturaTipo: 'proforma',
		ncf: '',
		selectedClientId: '',
		clientName: '',
		clientEmail: '',
		invoiceDate: '',
		dueDate: '',
		status: 'pending',
		notes: '',
		includeTax: false,
		discountAmount: 0,
		items: []
	});

	onMount(() => {
		editor = createEditorState(initial);
		taxMode = initial.includeTax ? 'added' : 'none';
		const initialMissingVariants = (
			actionForm as (ActionData & { missingVariants?: MissingVariant[] }) | null
		)?.missingVariants;
		if (initialMissingVariants?.length) {
			missingVariantConfirm = initialMissingVariants;
			createMissingDialogOpen = true;
		} else if (actionForm?.error) {
			void scrollToErrorBanner();
		}
	});

	function toTitleCase(str: string): string {
		return str
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	const clientProducts = $derived.by((): ProductOption[] => {
		return [...products].sort((a, b) =>
			getProductLabel(a).localeCompare(getProductLabel(b), undefined, { sensitivity: 'base' })
		);
	});

	const selectedClient = $derived(clients.find((c) => c.id === editor.selectedClientId) || null);
	const clientEmail = $derived(selectedClient?.email || editor.clientEmail || '');

	const canAddItem = $derived(!!editor.items[editor.items.length - 1]?.product_id);

	const isFormValid = $derived(
		editor.selectedClientId.trim() !== '' &&
			editor.items.length > 0 &&
			editor.items.every((item) => item.product_id && item.unit_price > 0)
	);

	function getModelName(modelId: string | null): string {
		if (!modelId) return '-';
		const found = models.find((m) => m.id === modelId);
		return found?.model ?? '-';
	}

	function getProductLabel(product: ProductOption): string {
		const modelName = getModelName(product.model);
		const formattedTitle = toTitleCase(product.title);
		return modelName === '-' ? formattedTitle : `${formattedTitle} - ${toTitleCase(modelName)}`;
	}

	function getClientName(client: ClientOption): string {
		return client.client_type === 'company'
			? toTitleCase(client.company_name || client.alias || 'Empresa sin nombre')
			: toTitleCase(client.full_name || 'Cliente sin nombre');
	}

	function getClientLabel(): string {
		if (!selectedClient) return '';

		return getClientName(selectedClient);
	}

	function getAvailableColors(itemId: string, productId: string): (typeof colors)[number][] {
		if (!productId) return colors;
		const currentColor = editor.items.find((i) => i.id === itemId)?.color;
		const usedColorsByOthers = editor.items
			.filter((i) => i.id !== itemId && i.product_id === productId && i.color)
			.map((i) => i.color);
		return colors.filter((c) => c.color === currentColor || !usedColorsByOthers.includes(c.color));
	}

	function getAvailableProducts(itemId: string): ProductOption[] {
		const currentProductId = editor.items.find((i) => i.id === itemId)?.product_id;
		return clientProducts.filter((product) => {
			if (product.id === currentProductId) return true;
			const otherItemsWithProduct = editor.items.filter(
				(i) => i.id !== itemId && i.product_id === product.id
			);
			if (otherItemsWithProduct.length === 0) return true;
			const hasColorSelected = otherItemsWithProduct.some((i) => i.color);
			if (!hasColorSelected) return false;
			const usedColors = otherItemsWithProduct.map((i) => i.color).filter(Boolean);
			const availableColorsForProduct = colors.filter((c) => !usedColors.includes(c.color));
			return availableColorsForProduct.length > 0;
		});
	}

	function createItem(): InvoiceFormItem {
		return {
			id: crypto.randomUUID(),
			product_id: '',
			color: '',
			model: null,
			quantity: 1,
			unit_price: 0
		};
	}

	function cleanupItems() {
		if (editor.items.length > 1) {
			const filtered = editor.items.filter(
				(item, index) => index === editor.items.length - 1 || item.product_id
			);
			if (filtered.length === 0) {
				editor.items = [createItem()];
			} else if (filtered.length < editor.items.length) {
				editor.items = filtered;
			}
		}
	}

	let loading = $state(false);
	let createMissingVariants = $state(false);
	let taxMode = $state<TaxMode>('none');
	let quickAddOpen = $state(false);
	let refreshDialogOpen = $state(false);
	let showPricesAlreadyAlert = $state(false);
	let missingVariantConfirm = $state<MissingVariant[] | null>(null);
	let createMissingDialogOpen = $state(false);
	let formElement: HTMLFormElement | null = null;
	let errorBanner: HTMLDivElement | null = null;

	const attachErrorBanner: Attachment<HTMLDivElement> = (element) => {
		errorBanner = element;
		return () => {
			if (errorBanner === element) errorBanner = null;
		};
	};

	const totalQuantity = $derived(
		editor.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
	);

	const lineTotal = $derived(
		editor.items.reduce(
			(sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
			0
		)
	);
	const taxRate = 18;
	const subtotal = $derived.by(() => (taxMode === 'included' ? lineTotal / 1.18 : lineTotal));
	const taxAmount = $derived.by(() => {
		if (taxMode === 'none') return 0;
		if (taxMode === 'included') return lineTotal - subtotal;
		return subtotal * (taxRate / 100);
	});
	const totalAmount = $derived.by(() => {
		const discount = Number(editor.discountAmount) || 0;
		if (taxMode === 'none') return Math.max(0, subtotal - discount);
		return Math.max(0, subtotal + taxAmount - discount);
	});

	function addItem() {
		const item = createItem();
		editor.items.push(item);
		cleanupItems();
		return item;
	}

	function getItemRowId(itemId: string) {
		return `invoice-item-${itemId}`;
	}

	async function scrollToErrorBanner() {
		await tick();
		if (!errorBanner) return;

		const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
			? 'auto'
			: 'smooth';
		errorBanner.scrollIntoView({ behavior, block: 'start' });
		errorBanner.focus({ preventScroll: true });
	}

	function removeItem(id: string) {
		if (editor.items.length > 1) {
			editor.items = editor.items.filter((item) => item.id !== id);
			cleanupItems();
		}
	}

	function canDuplicateItem(itemId: string): boolean {
		const item = editor.items.find((i) => i.id === itemId);
		if (!item?.product_id) return false;
		const usedColors = editor.items
			.filter((i) => i.product_id === item.product_id && i.color)
			.map((i) => i.color);
		return colors.some((c) => !usedColors.includes(c.color));
	}

	function duplicateItem(itemId: string) {
		const item = editor.items.find((i) => i.id === itemId);
		if (!item?.product_id || !canDuplicateItem(itemId)) return;

		const duplicated = createItem();
		duplicated.product_id = item.product_id;
		duplicated.model = item.model;
		duplicated.unit_price = item.unit_price;
		duplicated.quantity = item.quantity;
		editor.items.push(duplicated);
	}

	function handleQuickAdd(rows: Array<{ productId: string; color: string }>) {
		editor.items = editor.items.filter((i) => i.product_id);
		for (const row of rows) {
			const item = createItem();
			applyProductToItem(item, row.productId);
			item.color = row.color;
			editor.items.push(item);
		}
		if (editor.items.length === 0) editor.items = [createItem()];
		quickAddOpen = false;
	}

	function handleCsvImport(rows: CsvImportRow[], replacements: CsvImportRow[]) {
		const replacementQuantityByPair = new Map(
			replacements.map((row) => [
				`${row.productId}|${row.color.trim().toLowerCase()}`,
				row.quantity
			])
		);
		const nextItems = editor.items
			.filter((item) => item.product_id)
			.map((item) => {
				const quantity = replacementQuantityByPair.get(
					`${item.product_id}|${item.color.trim().toLowerCase()}`
				);
				return quantity === undefined ? item : { ...item, quantity };
			});
		for (const row of rows) {
			const item = createItem();
			applyProductToItem(item, row.productId);
			item.color = row.color;
			item.quantity = row.quantity;
			nextItems.push(item);
		}
		editor.items = nextItems.length > 0 ? nextItems : [createItem()];
	}

	// Orden de filas: clic en cabecera reordena array real (se guarda así).
	let sortState = $state<ProformaSortState>(null);
	let seqCounter = 0;
	const seqById = new SvelteMap<string, number>();
	function seqOf(id: string): number {
		let seq = seqById.get(id);
		if (seq === undefined) {
			seq = seqCounter++;
			seqById.set(id, seq);
		}
		return seq;
	}
	function sortProductTitle(productId: string): string {
		return clientProducts.find((p) => p.id === productId)?.title ?? '';
	}
	function sortModelName(productId: string): string {
		const modelId = clientProducts.find((p) => p.id === productId)?.model ?? null;
		if (!modelId) return '';
		return models.find((m) => m.id === modelId)?.model ?? '';
	}
	function colorRank(color: string): number {
		const normalizedColor = color.trim().toLocaleLowerCase();
		if (!normalizedColor) return Number.POSITIVE_INFINITY;
		const matchedColor = colors.find(
			(entry) => (entry.color ?? '').trim().toLocaleLowerCase() === normalizedColor
		);
		if (!matchedColor || !('sort_order' in matchedColor)) return Number.POSITIVE_INFINITY;
		const rank = Number(matchedColor.sort_order);
		return Number.isFinite(rank) ? rank : Number.POSITIVE_INFINITY;
	}
	function applySort(key: ProformaSortKey) {
		for (const item of editor.items) seqOf(item.id);
		sortState = nextSortState(sortState, key);
		editor.items = sortProformaItems(editor.items, sortState, {
			productTitle: sortProductTitle,
			modelName: sortModelName,
			colorRank,
			seqOf
		});
	}
	function sortDirOf(key: ProformaSortKey): 'asc' | 'desc' | null {
		return sortState?.key === key ? sortState.dir : null;
	}

	function applyProductToItem(item: InvoiceFormItem, productId: string) {
		item.product_id = productId;
		const product = clientProducts.find((entry) => entry.id === productId);
		const clientPrice = clientPrices.find(
			(cp) => cp.client_id === editor.selectedClientId && cp.product_id === productId
		);
		item.unit_price = clientPrice
			? Number(clientPrice.unit_price)
			: Number(product?.price_without_taxes || 0);
		item.model = product?.model ?? null;
		if (item.color) {
			const availableColors = getAvailableColors(item.id, productId);
			const colorStillAvailable = availableColors.some((c) => c.color === item.color);
			if (!colorStillAvailable) item.color = '';
		}
	}

	function refreshPrices() {
		for (const item of editor.items) {
			if (item.product_id) {
				applyProductToItem(item, item.product_id);
			}
		}
		refreshDialogOpen = false;
	}

	function formatCurrency(val: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
	}
</script>

<svelte:head>
	<title>Editar proforma - magikalInvoice</title>
</svelte:head>

{#if invoice}
	<div class="mx-auto flex max-w-4xl flex-1 flex-col justify-start space-y-6 text-[#171717]">
		<div>
			<a
				href={resolve(`/dashboard/proforma/${invoice.id}`)}
				class="inline-flex items-center gap-1.5 text-xs font-medium text-[#707070] transition-colors duration-200 hover:text-[#171717]"
			>
				<ArrowLeft class="h-3.5 w-3.5" />
				Volver a la proforma
			</a>
		</div>

		<div class="border-b border-[#ededed] pb-4">
			<h1 class="flex items-center gap-2 text-2xl font-medium tracking-tight text-[#171717]">
				<FileText class="h-6 w-6 text-[#3ecf8e]" />
				Editar proforma
			</h1>
			<p class="mt-0.5 text-xs text-[#707070]">
				Completa los datos del cliente, selecciona productos y ajusta impuestos para guardar los
				cambios.
			</p>
		</div>

		{#if actionForm?.error}
			<div
				{@attach attachErrorBanner}
				role="alert"
				tabindex="-1"
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
					<p class="font-medium">No se pudo guardar la proforma</p>
					<p class="mt-0.5 text-xs text-[#707070]">{actionForm.error}</p>
				</div>
			</div>
		{/if}

		<form
			action="?/updateInvoice"
			method="POST"
			use:enhance={({ formElement: submittedForm, formData }) => {
				formElement = submittedForm;
				loading = true;
				formData.set('create_missing_variants', createMissingVariants ? 'true' : 'false');
				return async ({ result, update }) => {
					if (result.type === 'failure' && result.data?.missingVariants) {
						missingVariantConfirm = result.data.missingVariants as MissingVariant[];
						createMissingDialogOpen = true;
						loading = false;
						createMissingVariants = false;
						await update({ reset: false });
						return;
					}
					loading = false;
					createMissingVariants = false;
					await update({ reset: false });
					if (result.type === 'failure' && result.data?.error) {
						await scrollToErrorBanner();
					}
				};
			}}
			class="space-y-6"
		>
			<input type="hidden" name="items" value={JSON.stringify(editor.items)} />

			<Card>
				<CardHeader>
					<CardTitle>1. Datos principales de la proforma</CardTitle>
				</CardHeader>
				<CardContent class="grid grid-cols-1 gap-5 md:grid-cols-3">
					<Input
						label="ID / número de proforma"
						name="invoice_number"
						bind:value={editor.invoiceNumber}
						disabled={loading}
					/>

					{#if isAdmin}
						<Select
							label="Tipo de proforma"
							name="factura_tipo"
							bind:value={editor.facturaTipo}
							disabled={loading}
						>
							<option value="proforma">Proforma</option>
						</Select>

						{#if editor.facturaTipo === 'valor_fiscal'}
							<Input
								label="NCF"
								name="ncf"
								bind:value={editor.ncf}
								placeholder="Ej: A0101010101"
								disabled={loading}
							/>
						{/if}
					{/if}

					<input type="hidden" name="status" value={editor.status} />

					<input type="hidden" name="client_id" value={editor.selectedClientId} />

					<Input
						label="Cliente"
						value={getClientLabel()}
						readonly
						disabled={loading}
						class="bg-[#fafafa] text-[#707070]"
					/>

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
						value={clientEmail}
						placeholder="Se autocompleta al seleccionar cliente"
						readonly
						disabled={loading}
					/>

					<Input
						label="Fecha de emisión"
						name="invoice_date"
						type="date"
						bind:value={editor.invoiceDate}
						required
						disabled={loading}
					/>

					<Input
						label="Fecha de vencimiento"
						name="due_date"
						type="date"
						bind:value={editor.dueDate}
						required
						disabled={loading}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader class="flex flex-row flex-wrap items-center justify-between gap-2">
					<CardTitle>2. Conceptos de cobro</CardTitle>
					<div class="flex flex-wrap items-center gap-2">
						<ProformaCsvImport
							products={clientProducts}
							{models}
							{colors}
							currentRows={editor.items}
							proformaNumber={editor.invoiceNumber}
							disabled={loading || !editor.selectedClientId}
							onImport={handleCsvImport}
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="flex items-center gap-1"
							onclick={() => applySort('reciente')}
							disabled={loading || editor.items.filter((i) => i.product_id).length < 2}
							title="Ordenar por último añadido (asc/desc)"
						>
							<History class="h-3.5 w-3.5" />
							Reciente
							{#if sortDirOf('reciente') === 'asc'}
								<ArrowUp class="h-3 w-3" />
							{:else if sortDirOf('reciente') === 'desc'}
								<ArrowDown class="h-3 w-3" />
							{/if}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="flex items-center gap-1"
							onclick={() => applySort('producto_color')}
							disabled={loading || editor.items.filter((i) => i.product_id).length < 2}
							title="Ordenar primero por producto y luego por el orden de colores del panel (asc/desc)"
						>
							<Palette class="h-3.5 w-3.5" />
							Producto + color
							{#if sortDirOf('producto_color') === 'asc'}
								<ArrowUp class="h-3 w-3" />
							{:else if sortDirOf('producto_color') === 'desc'}
								<ArrowDown class="h-3 w-3" />
							{/if}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="flex items-center gap-1"
							onclick={() => {
								const allMatch = editor.items.every((item) => {
									if (!item.product_id) return true;
									const product = clientProducts.find((entry) => entry.id === item.product_id);
									const clientPrice = clientPrices.find(
										(cp) =>
											cp.client_id === editor.selectedClientId && cp.product_id === item.product_id
									);
									const expectedPrice = clientPrice
										? Number(clientPrice.unit_price)
										: Number(product?.price_without_taxes || 0);
									return item.unit_price === expectedPrice;
								});
								if (allMatch) {
									showPricesAlreadyAlert = true;
								} else {
									refreshDialogOpen = true;
								}
							}}
							disabled={loading ||
								!editor.selectedClientId ||
								!editor.items.some((i) => i.product_id)}
						>
							<RefreshCw class="h-3.5 w-3.5" />
							Actualizar precios
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="flex items-center gap-1"
							onclick={() => (quickAddOpen = true)}
							disabled={loading || !editor.selectedClientId || !clientProducts.length}
						>
							<Zap class="h-3.5 w-3.5" />
							Añadir rápido
						</Button>
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
					</div>
				</CardHeader>
				<CardContent class="p-0">
					{#if !editor.selectedClientId}
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
									<th class="w-1/4 px-3 py-2.5 text-left font-semibold">
										<button
											type="button"
											onclick={() => applySort('producto')}
											class="inline-flex items-center gap-1 tracking-wider uppercase hover:text-[#171717]"
											title="Ordenar por producto + modelo"
										>
											Producto
											{#if sortDirOf('producto') === 'asc'}
												<ArrowUp class="h-3 w-3" />
											{:else if sortDirOf('producto') === 'desc'}
												<ArrowDown class="h-3 w-3" />
											{:else}
												<ArrowUpDown class="h-3 w-3 opacity-40" />
											{/if}
										</button>
									</th>
									<th class="w-1/4 px-3 py-2.5 text-left font-semibold">
										<button
											type="button"
											onclick={() => applySort('modelo')}
											class="inline-flex items-center gap-1 tracking-wider uppercase hover:text-[#171717]"
											title="Ordenar por modelo"
										>
											Modelo
											{#if sortDirOf('modelo') === 'asc'}
												<ArrowUp class="h-3 w-3" />
											{:else if sortDirOf('modelo') === 'desc'}
												<ArrowDown class="h-3 w-3" />
											{:else}
												<ArrowUpDown class="h-3 w-3 opacity-40" />
											{/if}
										</button>
									</th>
									<th class="w-1/5 px-3 py-2.5 text-left font-semibold">Color</th>
									<th class="w-24 px-3 py-2.5 text-left font-semibold">
										<button
											type="button"
											onclick={() => applySort('cantidad')}
											class="inline-flex items-center gap-1 tracking-wider uppercase hover:text-[#171717]"
											title="Ordenar por cantidad"
										>
											Cant.
											{#if sortDirOf('cantidad') === 'asc'}
												<ArrowUp class="h-3 w-3" />
											{:else if sortDirOf('cantidad') === 'desc'}
												<ArrowDown class="h-3 w-3" />
											{:else}
												<ArrowUpDown class="h-3 w-3 opacity-40" />
											{/if}
										</button>
									</th>
									<th class="w-32 px-3 py-2.5 text-left font-semibold">
										<button
											type="button"
											onclick={() => applySort('precio')}
											class="inline-flex items-center gap-1 tracking-wider uppercase hover:text-[#171717]"
											title="Ordenar por precio unitario"
										>
											Precio unit.
											{#if sortDirOf('precio') === 'asc'}
												<ArrowUp class="h-3 w-3" />
											{:else if sortDirOf('precio') === 'desc'}
												<ArrowDown class="h-3 w-3" />
											{:else}
												<ArrowUpDown class="h-3 w-3 opacity-40" />
											{/if}
										</button>
									</th>
									<th class="w-1/6 px-3 py-2.5 text-left font-semibold">Total</th>
									<th class="w-20 px-2 py-2.5 text-left font-semibold">Acciones</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-[#ededed]">
								{#each editor.items as item (item.id)}
									{@const availableProducts = getAvailableProducts(item.id) ?? []}
									{@const availableColors = getAvailableColors(item.id, item.product_id) ?? []}
									<tr
										id={getItemRowId(item.id)}
										data-invoice-item-id={item.id}
										class="hover:bg-[#fafafa]"
									>
										<td class="px-3 py-2">
											<SearchableSelect
												options={availableProducts.map((p) => ({
													value: p.id,
													label: getProductLabel(p)
												}))}
												bind:value={item.product_id}
												placeholder={editor.selectedClientId
													? 'Selecciona'
													: 'Primero elige un cliente'}
												disabled={loading ||
													!editor.selectedClientId ||
													availableProducts.length === 0}
												fuzzy
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
												disabled={loading || availableColors.length === 0}
												class="text-xs capitalize"
											>
												<option value="">Color</option>
												{#if availableColors.length === 0}
													<option value="" disabled>No hay colores</option>
												{/if}
												{#each availableColors as color (color.id)}
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
												class="h-9 w-full rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-left font-mono text-sm text-[#171717] focus-visible:ring-1 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
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
													disabled={loading}
													class="h-9 w-full rounded-md border border-[#dfdfdf] bg-white py-2 pr-3 pl-10 text-left font-mono text-sm text-[#171717] focus-visible:ring-1 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
												/>
											</div>
										</td>
										<td class="px-3 py-2">
											<div class="flex h-9 items-center justify-start">
												<span class="font-mono text-sm text-[#707070]">
													{formatCurrency(
														(Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
													)}
												</span>
											</div>
										</td>
										<td class="px-0.5 py-2">
											<div class="flex h-9 items-center justify-start gap-0">
												<Button
													type="button"
													variant="ghost"
													size="icon"
													class="h-7 w-7 text-[#707070] hover:text-[#3ecf8e]"
													disabled={loading || !canDuplicateItem(item.id)}
													onclick={() => duplicateItem(item.id)}
													title="Duplicar fila"
												>
													<Copy class="h-3.5 w-3.5" />
												</Button><Button
													type="button"
													variant="ghost"
													size="icon"
													class="h-7 w-7 text-[#707070] hover:text-[#e2005a]"
													disabled={editor.items.length <= 1 || loading}
													onclick={() => removeItem(item.id)}
													title="Eliminar fila"
												>
													<Trash2 class="h-3.5 w-3.5" />
												</Button>
											</div>
										</td>
									</tr>
								{/each}
								<tr class="hover:bg-transparent">
									<td colspan="7" class="px-3 py-2">
										<Button
											type="button"
											variant="ghost"
											size="sm"
											class="flex w-full items-center gap-1.5 text-xs text-[#707070] hover:text-[#3ecf8e]"
											onclick={addItem}
											disabled={loading || !canAddItem}
										>
											<Plus class="h-3.5 w-3.5" />
											Añadir fila
										</Button>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</CardContent>
			</Card>

			<div class="grid grid-cols-1 gap-5 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>3. Términos y notas</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="flex flex-col gap-1.5">
							<label
								for="notes"
								class="text-[11px] font-medium tracking-[0.12em] text-[#707070] uppercase"
								>Términos / notas de la proforma</label
							>
							<textarea
								id="notes"
								name="notes"
								rows="4"
								bind:value={editor.notes}
								placeholder="Gracias por su preferencia. El pago vence en 30 días mediante transferencia bancaria."
								disabled={loading}
								class="w-full resize-none rounded-md border border-[#dfdfdf] bg-white p-3 text-sm text-[#171717] transition-colors duration-200 placeholder:text-[#9a9a9a] focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none"
							></textarea>
						</div>
					</CardContent>
				</Card>

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
					<CardContent class="space-y-5">
						<div class="space-y-3 border-b border-[#ededed] pb-5">
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<p class="text-xs font-medium tracking-wider text-[#707070] uppercase">
										Impuestos
									</p>
									<span
										class="rounded-full border border-[#ededed] bg-[#fafafa] px-2.5 py-1 text-[10px] font-medium tracking-wider text-[#707070] uppercase"
									>
										{taxMode === 'none'
											? 'Sin ITBIS'
											: taxMode === 'included'
												? 'Incluye impuestos'
												: 'Incluir ITBIS'}
									</span>
								</div>
								<div
									class="grid grid-cols-1 gap-2 rounded-lg border border-[#dfdfdf] bg-[#fafafa] p-1.5 sm:grid-cols-3"
								>
									<label class="cursor-pointer">
										<input
											type="radio"
											name="tax_mode"
											value="none"
											bind:group={taxMode}
											disabled={loading}
											class="peer sr-only"
										/>
										<div
											class="rounded-md border border-transparent px-3 py-2 text-center text-sm font-medium text-[#707070] transition-colors peer-checked:border-[#24b47e] peer-checked:bg-white peer-checked:text-[#171717] peer-checked:shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
										>
											Sin ITBIS
										</div>
									</label>
									<label class="cursor-pointer">
										<input
											type="radio"
											name="tax_mode"
											value="included"
											bind:group={taxMode}
											disabled={loading}
											class="peer sr-only"
										/>
										<div
											class="rounded-md border border-transparent px-3 py-2 text-center text-sm font-medium text-[#707070] transition-colors peer-checked:border-[#24b47e] peer-checked:bg-white peer-checked:text-[#171717] peer-checked:shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
										>
											Incluye impuestos
										</div>
									</label>
									<label class="cursor-pointer sm:col-start-3">
										<input
											type="radio"
											name="tax_mode"
											value="added"
											bind:group={taxMode}
											disabled={loading}
											class="peer sr-only"
										/>
										<div
											class="rounded-md border border-transparent px-3 py-2 text-center text-sm font-medium text-[#707070] transition-colors peer-checked:border-[#24b47e] peer-checked:bg-white peer-checked:text-[#171717] peer-checked:shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
										>
											Incluir ITBIS
										</div>
									</label>
								</div>
								<p class="text-xs text-[#707070]">
									{taxMode === 'none'
										? 'Sin ITBIS, impuesto en 0.'
										: taxMode === 'included'
											? 'Incluye impuestos: subtotal neto desde precio con ITBIS.'
											: 'Incluir ITBIS: suma 18% al total final.'}
								</p>
							</div>

							<div class="flex justify-end">
								<div class="w-full max-w-sm">
									<Input
										label="Descuento ($)"
										name="discount_amount"
										type="number"
										min="0"
										step="any"
										bind:value={editor.discountAmount}
										disabled={loading}
									/>
								</div>
							</div>
						</div>

						<div class="rounded-xl border border-[#ededed] bg-[#fafafa] p-4">
							<div class="space-y-3 text-sm text-[#707070]">
								<div class="flex items-center justify-between">
									<span>Cantidad de artículos</span>
									<span class="font-mono font-medium text-[#171717]">{totalQuantity}</span>
								</div>
								<div class="flex items-center justify-between">
									<span>{taxMode === 'included' ? 'Subtotal neto' : 'Subtotal'}</span>
									<span class="font-mono font-medium text-[#171717]"
										>{formatCurrency(subtotal)}</span
									>
								</div>
								<div class="flex items-center justify-between">
									<span>Impuesto ({taxRate}%)</span>
									<span class="font-mono font-medium text-[#171717]"
										>{formatCurrency(taxAmount)}</span
									>
								</div>
								<div class="flex items-center justify-between">
									<span>Descuento</span>
									<span class="font-mono font-medium text-[#171717]"
										>-{formatCurrency(editor.discountAmount || 0)}</span
									>
								</div>
							</div>

							<div
								class="mt-4 flex items-center justify-between border-t border-[#dfdfdf] pt-4 text-base font-medium"
							>
								<span class="flex items-center gap-1 text-[#24b47e]">
									<DollarSign class="h-4.5 w-4.5" />
									Total a pagar
								</span>
								<span class="font-mono text-xl text-[#171717]">{formatCurrency(totalAmount)}</span>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<div class="flex justify-end gap-3 border-t border-[#ededed] pt-6">
				<a href={resolve(`/dashboard/proforma/${invoice.id}`)}>
					<Button variant="outline" disabled={loading}>Cancelar</Button>
				</a>

				<Button type="submit" disabled={loading || !isFormValid} class="flex items-center gap-1.5">
					{#if loading}
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-[#171717]/20 border-t-[#171717]"
						></div>
						Guardando cambios...
					{:else}
						<Save class="h-4 w-4" />
						Guardar cambios
					{/if}
				</Button>
			</div>
		</form>
	</div>

	{#if editor.items.length >= 2}
		<button
			type="button"
			transition:fly={{ y: 16, duration: 220 }}
			class="group fixed right-5 bottom-5 z-40 flex h-12 w-12 items-center justify-center rounded-md bg-[#3ecf8e] text-[#171717] shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_8px_rgba(36,180,126,0.35)] ring-1 ring-[#24b47e]/40 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#24b47e] hover:shadow-[0_16px_48px_rgba(0,0,0,0.12),0_4px_12px_rgba(36,180,126,0.45)] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:ring-offset-2 focus-visible:outline-none active:translate-y-0 active:scale-95 disabled:transform-none disabled:cursor-not-allowed disabled:opacity-50 md:right-8 md:bottom-8"
			disabled={loading || !editor.selectedClientId || !clientProducts.length}
			onclick={() => (quickAddOpen = true)}
			aria-label="Añadir rápido"
			title="Añadir rápido"
		>
			<Zap class="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" />
		</button>
	{/if}
{/if}

{#if createMissingDialogOpen && missingVariantConfirm}
	<Dialog
		open
		title="Crear variantes faltantes"
		description="Algunos conceptos no tienen una variante de inventario. ¿Deseas crearlas ahora?"
		class="max-w-md"
		onClose={() => {
			createMissingDialogOpen = false;
			missingVariantConfirm = null;
			createMissingVariants = false;
		}}
	>
		<div class="space-y-3">
			<div class="flex items-start gap-2 text-sm text-[#e2005a]">
				<AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" />
				<p>Las siguientes variantes se crearán con stock 0:</p>
			</div>
			<ul
				class="max-h-48 space-y-2 overflow-y-auto rounded-md border border-[#ededed] bg-[#fafafa] p-3"
			>
				{#each missingVariantConfirm as variant (variant.productId + ':' + (variant.color || 'none'))}
					<li class="text-sm text-[#171717]">
						<span class="font-medium">{toTitleCase(variant.productTitle)}</span>
						{#if variant.color}
							<span class="text-[#707070]">· {toTitleCase(variant.color)}</span>
						{:else}
							<span class="text-[#707070]">· Sin color</span>
						{/if}
					</li>
				{/each}
			</ul>
		</div>

		{#snippet footer()}
			<button
				type="button"
				class="rounded-md border border-[#dfdfdf] bg-white px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#fafafa]"
				onclick={() => {
					createMissingDialogOpen = false;
					missingVariantConfirm = null;
					createMissingVariants = false;
				}}
			>
				Cancelar
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-md bg-[#3ecf8e] px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:opacity-50"
				disabled={loading}
				onclick={() => {
					createMissingVariants = true;
					createMissingDialogOpen = false;
					formElement?.requestSubmit();
				}}
			>
				{#if loading}
					Creando...
				{:else}
					<Plus class="h-4 w-4" />
					Crear variantes y guardar
				{/if}
			</button>
		{/snippet}
	</Dialog>
{/if}

{#if quickAddOpen}
	<QuickAddDialog
		open
		products={clientProducts}
		{models}
		{colors}
		existingItems={editor.items}
		onClose={() => (quickAddOpen = false)}
		onAdd={handleQuickAdd}
	/>
{/if}

{#if refreshDialogOpen}
	<Dialog
		open
		title="Actualizar precios"
		description="Se sincronizarán los precios de todos los conceptos con el precio actual del cliente seleccionado."
		class="max-w-md"
		onClose={() => (refreshDialogOpen = false)}
	>
		<div class="flex items-start gap-2 text-sm text-[#e2005a]">
			<AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" />
			<p>Los precios manuales que hayas editado se sobrescribirán.</p>
		</div>

		{#snippet footer()}
			<button
				type="button"
				class="rounded-md border border-[#dfdfdf] bg-white px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#fafafa]"
				onclick={() => (refreshDialogOpen = false)}
			>
				Cancelar
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-md bg-[#3ecf8e] px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
				onclick={refreshPrices}
			>
				<RefreshCw class="h-4 w-4" />
				Actualizar
			</button>
		{/snippet}
	</Dialog>
{/if}

{#if loading}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
		role="status"
		aria-live="polite"
	>
		<div
			class="flex max-w-sm flex-col items-center gap-4 rounded-xl border border-[#dfdfdf] bg-white p-6 text-center shadow-[0_16px_48px_rgba(0,0,0,0.12)]"
		>
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-[#171717]/20 border-t-[#3ecf8e]"
			></div>
			<p class="text-sm font-medium text-[#171717]">
				{#if createMissingVariants}
					Guardando variantes nuevas...
				{:else}
					Revisando si hay una variante nueva, esto puede tardar unos segundos...
				{/if}
			</p>
		</div>
	</div>
{/if}

{#if showPricesAlreadyAlert}
	<Dialog
		open
		title="Actualizar precios"
		description="Todos los precios ya están actualizados con el precio actual del cliente."
		class="max-w-md"
		onClose={() => (showPricesAlreadyAlert = false)}
	>
		{#snippet footer()}
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-md bg-[#3ecf8e] px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
				onclick={() => (showPricesAlreadyAlert = false)}
			>
				OK
			</button>
		{/snippet}
	</Dialog>
{/if}
