<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import type { Attachment } from 'svelte/attachments';
	import { Download, Upload } from '@lucide/svelte';
	import {
		downloadCurrentRowsCsv,
		downloadSampleCsv,
		parseProformaCsv,
		type CsvColorOption,
		type CsvCurrentRow,
		type CsvImportRow,
		type CsvModelOption,
		type CsvProductOption,
		type CsvRowError
	} from '$lib/proformaCsv';

	type Props = {
		products: CsvProductOption[];
		models: CsvModelOption[];
		colors: CsvColorOption[];
		existingPairs?: Set<string>;
		currentRows: CsvCurrentRow[];
		proformaNumber: string;
		disabled?: boolean;
		onImport: (rows: CsvImportRow[]) => void;
	};

	let {
		products,
		models,
		colors,
		existingPairs,
		currentRows,
		proformaNumber,
		disabled = false,
		onImport
	}: Props = $props();

	let fileInput: HTMLInputElement | null = null;
	let reportOpen = $state(false);
	let importedCount = $state(0);
	let rowErrors = $state<CsvRowError[]>([]);
	let fileName = $state('');

	function handleDownload() {
		downloadSampleCsv(products, models, colors);
	}

	function handleCurrentRowsDownload() {
		downloadCurrentRowsCsv(currentRows, products, models, proformaNumber);
	}

	const hasExportableRows = $derived(
		currentRows.some(
			(row) => row.product_id && products.some((product) => product.id === row.product_id)
		)
	);

	const attachFileInput: Attachment<HTMLInputElement> = (input) => {
		fileInput = input;
		return () => {
			if (fileInput === input) fileInput = null;
		};
	};

	function handlePickFile() {
		if (disabled) return;
		fileInput?.click();
	}

	async function handleFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		fileName = file.name;
		const text = await file.text();
		const { rows, errors } = parseProformaCsv(text, products, models, colors, existingPairs);
		if (rows.length > 0) onImport(rows);
		importedCount = rows.length;
		rowErrors = errors;
		reportOpen = true;
	}
</script>

<input
	{@attach attachFileInput}
	type="file"
	accept=".csv,text/csv"
	class="hidden"
	aria-hidden="true"
	tabindex="-1"
	onchange={handleFileChange}
/>

<Button
	type="button"
	variant="outline"
	size="sm"
	class="flex items-center gap-1"
	onclick={handleDownload}
	title="Descargar plantilla CSV con ejemplos reales de tu catálogo: producto, modelo, color, cantidad"
>
	<Download class="h-3.5 w-3.5" />
	Plantilla
</Button>

<Button
	type="button"
	variant="outline"
	size="sm"
	class="flex items-center gap-1"
	onclick={handleCurrentRowsDownload}
	disabled={disabled || !hasExportableRows}
	title={hasExportableRows
		? 'Descargar los conceptos actuales en CSV: producto, modelo, color, cantidad'
		: 'Añade al menos un producto para descargar el CSV'}
>
	<Download class="h-3.5 w-3.5" />
	Descargar CSV
</Button>

<Button
	type="button"
	variant="outline"
	size="sm"
	class="flex items-center gap-1"
	onclick={handlePickFile}
	disabled={disabled || products.length === 0}
	title={products.length === 0 ? 'No hay productos para importar' : 'Subir CSV para crear filas'}
>
	<Upload class="h-3.5 w-3.5" />
	Subir CSV
</Button>

{#if reportOpen}
	<Dialog
		open
		title="Importación CSV"
		description={fileName
			? `${fileName}: ${importedCount} fila(s) añadida(s)${rowErrors.length ? `, ${rowErrors.length} con error` : ''}. Precio lo pone el sistema.`
			: 'Resultado de la importación.'}
		class="max-w-md"
		onClose={() => (reportOpen = false)}
	>
		{#if importedCount > 0 && rowErrors.length === 0}
			<p class="text-sm text-[#171717]">
				{importedCount} fila(s) añadida(s) sin errores.
			</p>
		{:else if importedCount === 0 && rowErrors.length > 0}
			<p class="text-sm text-[#e2005a]">Nada importado. Corrige el CSV e intenta de nuevo.</p>
		{:else if importedCount === 0 && rowErrors.length === 0}
			<p class="text-sm text-[#707070]">Archivo sin filas de datos.</p>
		{:else}
			<p class="text-sm text-[#171717]">
				{importedCount} fila(s) añadida(s). Revisa las omitidas:
			</p>
		{/if}

		{#if rowErrors.length > 0}
			<ul
				class="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-md border border-[#ededed] bg-[#fafafa] p-3"
			>
				{#each rowErrors as err (err.line + err.reason)}
					<li class="text-xs text-[#171717]">
						<span class="font-medium">Línea {err.line}:</span>
						<span class="text-[#707070]"> {err.reason}</span>
					</li>
				{/each}
			</ul>
			<p class="mt-3 text-xs text-[#707070]">
				Formato: <span class="font-mono">producto,modelo,color,cantidad</span>. Usa los nombres
				exactos de la plantilla — ya trae ejemplos reales de tu catálogo. Cantidad &gt; 0.
			</p>
		{/if}

		{#snippet footer()}
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-md bg-[#3ecf8e] px-4 py-2 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
				onclick={() => (reportOpen = false)}
			>
				OK
			</button>
		{/snippet}
	</Dialog>
{/if}
