<script lang="ts">
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { Zap } from '@lucide/svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	type ProductOption = {
		id: string;
		title: string;
		price_without_taxes: number | string;
		model: string | null;
	};
	type ModelOption = { id: string; model: string };
	type ColorOption = { id: string; color: string };
	type ExistingItem = { product_id: string; color: string };

	let {
		open = false,
		products = [],
		models = [],
		colors = [],
		existingItems = [],
		onClose = () => {},
		onAdd = () => {}
	}: {
		open?: boolean;
		products?: ProductOption[];
		models?: ModelOption[];
		colors?: ColorOption[];
		existingItems?: ExistingItem[];
		onClose?: () => void;
		onAdd?: (rows: Array<{ productId: string; color: string }>) => void;
	} = $props();

	function toTitleCase(str: string): string {
		return str
			.split(' ')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
			.join(' ');
	}

	const productsByTitle = $derived.by(() => {
		const map = new SvelteMap<string, ProductOption[]>();
		for (const p of products) {
			const arr = map.get(p.title) ?? [];
			arr.push(p);
			map.set(p.title, arr);
		}
		return map;
	});

	const uniqueProductTitles = $derived(
		[...productsByTitle.keys()].sort((a, b) =>
			toTitleCase(a).localeCompare(toTitleCase(b), undefined, { sensitivity: 'base' })
		)
	);

	let selectedTitles = $state<Record<string, boolean>>({});
	let selectedModels = $state<Record<string, boolean>>({});
	let selectedColors = $state<Record<string, Record<string, boolean>>>({});

	const selectedTitleSet = $derived(
		new SvelteSet(
			Object.entries(selectedTitles)
				.filter(([, v]) => v)
				.map(([k]) => k)
		)
	);

	const eligibleModels = $derived(
		models
			.filter((m) => products.some((p) => p.model === m.id && selectedTitleSet.has(p.title)))
			.sort((a, b) =>
				toTitleCase(a.model).localeCompare(toTitleCase(b.model), undefined, {
					sensitivity: 'base'
				})
			)
	);

	const selectedModelIds = $derived(
		Object.entries(selectedModels)
			.filter(([, v]) => v)
			.map(([k]) => k)
	);

	const existingPairs = $derived.by(() => {
		const set = new SvelteSet<string>();
		for (const it of existingItems) {
			if (it.product_id && it.color) {
				set.add(`${it.product_id}|${it.color.trim().toLowerCase()}`);
			}
		}
		return set;
	});

	function productsForModel(modelId: string): ProductOption[] {
		return products.filter((p) => p.model === modelId && selectedTitleSet.has(p.title));
	}

	const preview = $derived.by(() => {
		const rows: Array<{ productId: string; color: string }> = [];
		let skipped = 0;
		for (const modelId of selectedModelIds) {
			const prods = productsForModel(modelId);
			const colorMap = selectedColors[modelId] ?? {};
			const chosenColors = colors.filter((c) => colorMap[c.color]);
			for (const prod of prods) {
				for (const col of chosenColors) {
					const key = `${prod.id}|${col.color.trim().toLowerCase()}`;
					if (existingPairs.has(key)) {
						skipped++;
						continue;
					}
					rows.push({ productId: prod.id, color: col.color });
				}
			}
		}
		return { rows, skipped };
	});

	const canAdd = $derived(preview.rows.length > 0);

	function toggleTitle(title: string, checked: boolean) {
		selectedTitles[title] = checked;
		if (!checked) {
			for (const m of eligibleModels) {
				if (selectedModels[m.id]) {
					const stillEligible = products.some(
						(p) => p.model === m.id && selectedTitleSet.has(p.title)
					);
					if (!stillEligible) {
						selectedModels[m.id] = false;
						selectedColors[m.id] = {};
					}
				}
			}
		}
	}

	function toggleModel(modelId: string, checked: boolean) {
		selectedModels[modelId] = checked;
		if (checked && !selectedColors[modelId]) {
			selectedColors[modelId] = {};
		} else if (!checked) {
			selectedColors[modelId] = {};
		}
	}

	function handleAdd() {
		if (!canAdd) return;
		onAdd(preview.rows);
	}
</script>

<Dialog
	{open}
	title="Añadir rápido"
	description="Selecciona productos, luego los modelos y los colores para cada modelo."
	{onClose}
	class="max-w-lg"
>
	{#if uniqueProductTitles.length === 0}
		<p class="text-sm text-[#707070]">No hay productos disponibles.</p>
	{:else}
		<div class="space-y-4">
			<div>
				<p class="mb-2 text-[11px] font-medium tracking-[0.12em] text-[#707070] uppercase">
					Productos
				</p>
				<div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
					{#each uniqueProductTitles as title (title)}
						<label
							class="flex cursor-pointer items-center gap-2 rounded-md border border-[#dfdfdf] px-3 py-2 text-sm transition-colors hover:bg-[#fafafa]"
						>
							<input
								type="checkbox"
								class="h-4 w-4 accent-[#3ecf8e]"
								checked={selectedTitles[title] ?? false}
								onchange={(e) => toggleTitle(title, e.currentTarget.checked)}
							/>
							<span class="text-[#171717]">{toTitleCase(title)}</span>
						</label>
					{/each}
				</div>
			</div>

			{#if selectedTitleSet.size > 0}
				<div class="border-t border-[#ededed] pt-4">
					<p class="mb-2 text-[11px] font-medium tracking-[0.12em] text-[#707070] uppercase">
						Modelos
					</p>
					{#if eligibleModels.length === 0}
						<p class="text-xs text-[#707070]">Ningún modelo tiene los productos seleccionados.</p>
					{:else}
						<div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
							{#each eligibleModels as m (m.id)}
								<label
									class="flex cursor-pointer items-center gap-2 rounded-md border border-[#dfdfdf] px-3 py-2 text-sm transition-colors hover:bg-[#fafafa]"
								>
									<input
										type="checkbox"
										class="h-4 w-4 accent-[#3ecf8e]"
										checked={selectedModels[m.id] ?? false}
										onchange={(e) => toggleModel(m.id, e.currentTarget.checked)}
									/>
									<span class="text-[#171717]">{toTitleCase(m.model)}</span>
								</label>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			{#each selectedModelIds as modelId (modelId)}
				{@const model = models.find((m) => m.id === modelId)}
				{@const prods = productsForModel(modelId)}
				<div class="rounded-lg border border-[#ededed] bg-[#fafafa] p-3">
					<div class="mb-1 flex items-center justify-between">
						<p class="text-sm font-medium text-[#171717]">
							{model ? toTitleCase(model.model) : '-'}
						</p>
						<span class="text-xs text-[#707070]">{prods.length} producto(s)</span>
					</div>
					<p class="mb-2 text-xs text-[#707070]">
						{prods.map((p) => toTitleCase(p.title)).join(', ')}
					</p>
					<p class="mb-2 text-[11px] font-medium tracking-[0.12em] text-[#707070] uppercase">
						Colores
					</p>
					{#if colors.length === 0}
						<p class="text-xs text-[#707070]">No hay colores disponibles.</p>
					{:else}
						<div class="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
							{#each colors as c (c.id)}
								<label
									class="flex cursor-pointer items-center gap-2 rounded-md border border-[#dfdfdf] bg-white px-2.5 py-1.5 text-xs transition-colors hover:bg-[#fafafa]"
								>
									<input
										type="checkbox"
										class="h-3.5 w-3.5 accent-[#3ecf8e]"
										bind:checked={selectedColors[modelId][c.color]}
									/>
									<span class="text-[#171717] capitalize">{c.color}</span>
								</label>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#snippet footer()}
		<div class="flex w-full items-center justify-between gap-3">
			<span class="text-xs text-[#707070]">
				{#if canAdd}
					{preview.rows.length} fila(s) se crearán
					{#if preview.skipped > 0}
						· {preview.skipped} ya existían
					{/if}
				{:else}
					Selecciona productos, modelos y colores
				{/if}
			</span>
			<div class="flex items-center gap-3">
				<button
					type="button"
					class="rounded-md border border-[#dfdfdf] bg-white px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#fafafa]"
					onclick={onClose}
				>
					Cancelar
				</button>
				<Button
					variant="default"
					size="sm"
					disabled={!canAdd}
					onclick={handleAdd}
					class="flex items-center gap-1.5"
				>
					<Zap class="h-3.5 w-3.5" />
					Añadir{preview.rows.length > 0 ? ` ${preview.rows.length}` : ''}
				</Button>
			</div>
		</div>
	{/snippet}
</Dialog>
