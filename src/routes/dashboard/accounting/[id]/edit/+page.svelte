<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PaymentForm from '../../PaymentForm.svelte';

	type Client = {
		id: string;
		client_type: string;
		full_name: string;
		company_name?: string | null;
		alias?: string | null;
		rnc?: string | null;
		email?: string | null;
	};

	type ClientBalance = {
		clientId: string;
		name: string;
		creditBalance: number;
		invoiceCount: number;
		overdueBalance: number;
	};

	type EditPageData = {
		initialPayment?: {
			id?: string;
		} | null;
		payment?: {
			id?: string;
		} | null;
		clients?: Client[];
		clientBalances?: ClientBalance[];
		actionUrl?: string;
	};

	let { data, form }: { data: EditPageData; form: { error?: string } | null } = $props();

	const initialPayment = $derived(data.initialPayment ?? data.payment ?? null);
	const paymentId = $derived(initialPayment?.id ?? '');

	function goToDetail() {
		if (paymentId) {
			goto(resolve('/dashboard/accounting/[id]', { id: paymentId }));
			return;
		}

		goto(resolve('/dashboard/accounting'));
	}
</script>

<svelte:head>
	<title>Editar pago - magikalInvoice</title>
</svelte:head>

{#key paymentId || 'accounting-payment-edit'}
	<PaymentForm
		mode="edit"
		clients={data.clients || []}
		clientBalances={data.clientBalances || []}
		{form}
		{initialPayment}
		actionUrl={data.actionUrl || '?/updatePayment'}
		onBack={goToDetail}
		onCancel={goToDetail}
	/>
{/key}
