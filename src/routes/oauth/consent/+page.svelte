<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import { ShieldCheck } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Autorizar acceso - magikalInvoice</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center px-4 py-12">
	<Card class="w-full max-w-md">
		<CardHeader>
			<div class="flex items-center gap-2">
				<ShieldCheck class="h-5 w-5" />
				<CardTitle>Autorizar acceso</CardTitle>
			</div>
		</CardHeader>
		<CardContent>
			<div class="space-y-4 text-sm">
				<p>
					<strong>{data.clientName}</strong> quiere usar magikalInvoice con tu cuenta
					<strong>{data.email}</strong>.
				</p>
				<p class="text-[#707070]">
					Podrá hacer lo mismo que tú puedes hacer en la app con tu rol (<strong
						>{data.role ?? 'sin rol'}</strong
					>): consultar datos y, si tu rol lo permite, crear y editar proformas, registrar pagos o
					convertir proformas en facturas.
				</p>
				{#if data.clientUri}
					<p class="text-xs text-[#707070]">Sitio de la aplicación: {data.clientUri}</p>
				{/if}
				{#if form?.error}
					<p class="text-sm text-red-600">{form.error}</p>
				{/if}
				<div class="flex gap-2 pt-2">
					<form method="POST" action="?/deny" class="flex-1">
						<input type="hidden" name="authorization_id" value={data.authorizationId} />
						<Button type="submit" variant="outline" class="w-full">Rechazar</Button>
					</form>
					<form method="POST" action="?/approve" class="flex-1">
						<input type="hidden" name="authorization_id" value={data.authorizationId} />
						<Button type="submit" class="w-full">Autorizar</Button>
					</form>
				</div>
			</div>
		</CardContent>
	</Card>
</div>
