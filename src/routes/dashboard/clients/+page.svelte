<script lang="ts">
	import { enhance } from '$app/forms';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import { Contact, Users } from '@lucide/svelte';

	let { data, form } = $props();

	const clients = $derived(data.clients || []);

	let loading = $state(false);
	let clientType = $state<'person' | 'company'>('person');
</script>

<svelte:head>
	<title>Clientes - FacturaFlow</title>
</svelte:head>

<div class="space-y-6 flex-1 flex flex-col justify-start text-[#171717]">
			<div class="border-b border-[#ededed] pb-5">
		<h1 class="text-2xl font-medium text-[#171717] tracking-tight flex items-center gap-2">
			<Users class="h-6 w-6 text-[#3ecf8e]" />
			Clientes
		</h1>
		<p class="text-[#707070] text-xs mt-0.5">Registra personas o empresas para reutilizarlas en tus facturas.</p>
	</div>

	{#if form?.error}
		<div class="bg-[#e2005a]/10 border border-[#e2005a]/20 p-4 rounded-xl text-sm text-[#e2005a] flex items-start gap-2.5 shadow-sm">
			<Contact class="h-5 w-5 flex-shrink-0 mt-0.5" />
			<div>
				<p class="font-medium">No se pudo guardar el cliente</p>
				<p class="text-xs text-[#707070] mt-0.5">{form.error}</p>
			</div>
		</div>
	{/if}

	{#if form?.success}
		<div class="bg-[#3ecf8e]/12 border border-[#3ecf8e]/25 p-4 rounded-xl text-sm text-[#171717] flex items-start gap-2.5 shadow-sm">
			<Contact class="h-5 w-5 flex-shrink-0 mt-0.5 text-[#24b47e]" />
			<div>
				<p class="font-medium">Cliente guardado</p>
				<p class="text-xs text-[#707070] mt-0.5">El registro quedó disponible en el listado.</p>
			</div>
		</div>
	{/if}

	<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
		<Card class="xl:col-span-1">
			<CardHeader>
				<CardTitle>Nuevo cliente</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					action="?/createClient"
					method="POST"
					class="space-y-4"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							loading = false;
							await update();
						};
					}}
				>
					<Select label="Tipo de cliente" name="client_type" bind:value={clientType} required disabled={loading}>
						<option value="person">Persona</option>
						<option value="company">Empresa</option>
					</Select>

					{#if clientType === 'person'}
						<Input
							label="Nombre completo"
							name="full_name"
							type="text"
							placeholder="Juan Pérez"
							required
							disabled={loading}
						/>
					{:else}
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<Input label="Alias" name="alias" type="text" placeholder="CCARIBE" required disabled={loading} />
							<Input label="RNC" name="rnc" type="text" placeholder="1-01-12345-6" required disabled={loading} />
						</div>
						<Input label="Nombre de empresa" name="company_name" type="text" placeholder="Constructora del Caribe SRL" required disabled={loading} />
					{/if}

			<div class="flex items-center gap-2 bg-[#fafafa] border border-[#ededed] p-3 rounded-lg text-[11px] text-[#707070]">
				<Contact class="h-4 w-4 text-[#3ecf8e] flex-shrink-0" />
				<p>{clientType === 'company' ? 'La empresa requiere alias, RNC y nombre de empresa.' : 'La persona sólo requiere el nombre completo.'}</p>
			</div>

					<Button type="submit" class="w-full" disabled={loading}>Guardar cliente</Button>
				</form>
			</CardContent>
		</Card>

		<Card class="xl:col-span-2">
			<CardHeader>
				<CardTitle>Listado de clientes</CardTitle>
			</CardHeader>
			<CardContent class="p-0">
				<div class="overflow-x-auto w-full">
			<table class="w-full text-sm text-left text-[#171717]">
				<thead class="text-xs uppercase bg-[#fafafa] text-[#707070] border-b border-[#ededed] tracking-wider">
							<tr>
								<th class="px-6 py-4 font-bold">Tipo</th>
						<th class="px-6 py-4 font-bold">Nombre / Empresa</th>
						<th class="px-6 py-4 font-bold">Alias / RNC</th>
							</tr>
						</thead>
				<tbody class="divide-y divide-[#ededed]">
							{#if clients.length === 0}
								<tr>
								<td colspan="3" class="px-6 py-12 text-center text-[#707070] text-xs">Aún no hay clientes registrados.</td>
								</tr>
							{:else}
						{#each clients as client (client.id)}
						<tr class="hover:bg-[#fafafa] transition-colors duration-150">
										<td class="px-6 py-4 whitespace-nowrap">
											{#if client.client_type === 'company'}
									<Badge variant="info">Empresa</Badge>
											{:else}
									<Badge variant="secondary">Persona</Badge>
											{/if}
										</td>
									<td class="px-6 py-4">
										<div class="space-y-0.5">
									<p class="font-medium text-[#171717]">{client.client_type === 'company' ? client.company_name : client.full_name}</p>
									<p class="text-[11px] text-[#707070]">{client.client_type === 'company' ? 'Cliente empresa' : 'Cliente persona'}</p>
										</div>
									</td>
								<td class="px-6 py-4 whitespace-nowrap text-xs text-[#707070]">
										{client.client_type === 'company' ? `${client.alias} / ${client.rnc}` : '—'}
									</td>
								</tr>
							{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>
	</div>
</div>
