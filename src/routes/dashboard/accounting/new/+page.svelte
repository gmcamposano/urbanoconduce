<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PaymentForm from '../PaymentForm.svelte';

	let { data, form } = $props();

	function goToAccounting() {
		goto(resolve('/dashboard/accounting'));
	}
</script>

<svelte:head>
	<title>Registrar Pago - magikalInvoice</title>
</svelte:head>

<PaymentForm
	mode="create"
	clients={data.clients || []}
	clientBalances={data.clientBalances || []}
	{form}
	onBack={goToAccounting}
	onCancel={goToAccounting}
/>
