<script lang="ts">
	import InvoiceEditor from './InvoiceEditor.svelte';
	import { buildInvoiceEditorState } from '$lib/invoiceEditor';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Editar factura - FacturaFlow</title>
</svelte:head>

{#key data.invoice.id}
	{@const initial = buildInvoiceEditorState({
		invoice: data.invoice,
		items: data.items,
		products: data.products,
		colors: data.colors
	})}
	<InvoiceEditor invoice={data.invoice} products={data.products} colors={data.colors} {initial} {form} />
{/key}
