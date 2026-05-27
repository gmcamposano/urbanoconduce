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

<div class="space-y-6 flex-1 flex flex-col justify-start">
			<div class="border-b border-zinc-900 pb-5">
		<h1 class="text-2xl font-black text-white tracking-tight flex items-center gap-2">
			<Users class="h-6 w-6 text-indigo-500" />
			Clientes
		</h1>
		<p class="text-zinc-500 text-xs mt-0.5">Registra personas o empresas para reutilizarlas en tus facturas.</p>
	</div>

	{#if form?.error}
		<div class="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-sm text-rose-400 flex items-start gap-2.5 shadow-lg shadow-rose-500/5">
			<Contact class="h-5 w-5 flex-shrink-0 mt-0.5" />
			<div>
				<p class="font-bold">No se pudo guardar el cliente</p>
				<p class="text-xs text-zinc-400 mt-0.5">{form.error}</p>
			</div>
		</div>
	{/if}

	{#if form?.success}
		<div class="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-sm text-emerald-400 flex items-start gap-2.5 shadow-lg shadow-emerald-500/5">
			<Contact class="h-5 w-5 flex-shrink-0 mt-0.5" />
			<div>
				<p class="font-bold">Cliente guardado</p>
				<p class="text-xs text-zinc-400 mt-0.5">El registro quedó disponible en el listado.</p>
			</div>
		</div>
	{/if}

	<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
		<Card class="border-zinc-800 bg-zinc-950/40 xl:col-span-1">
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
						<option value="person" class="bg-zinc-950">Persona</option>
						<option value="company" class="bg-zinc-950">Empresa</option>
					</Select>

					<Input
						label={clientType === 'company' ? 'Nombre del contacto' : 'Nombre completo'}
						name="full_name"
						type="text"
						placeholder={clientType === 'company' ? 'Ana García' : 'Juan Pérez'}
						required
						disabled={loading}
					/>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<Input label="Correo electrónico" name="email" type="email" placeholder="correo@cliente.com" disabled={loading} />
						<Input label="Teléfono" name="phone" type="tel" placeholder="809-555-1234" disabled={loading} />
					</div>

					{#if clientType === 'company'}
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<Input label="Alias" name="alias" type="text" placeholder="CCARIBE" required disabled={loading} />
							<Input label="RNC" name="rnc" type="text" placeholder="1-01-12345-6" required disabled={loading} />
						</div>
						<Input label="Nombre de empresa" name="company_name" type="text" placeholder="Constructora del Caribe SRL" required disabled={loading} />
					{/if}

					<div class="flex items-center gap-2 bg-indigo-500/5 border border-indigo-500/10 p-3 rounded-lg text-[11px] text-zinc-400">
						<Contact class="h-4 w-4 text-indigo-400 flex-shrink-0" />
						<p>{clientType === 'company' ? 'La empresa requiere alias, RNC y nombre de empresa.' : 'Las personas sólo necesitan nombre y sus datos de contacto.'}</p>
					</div>

					<Button type="submit" class="w-full" disabled={loading}>Guardar cliente</Button>
				</form>
			</CardContent>
		</Card>

		<Card class="border-zinc-900 bg-zinc-950/20 xl:col-span-2">
			<CardHeader>
				<CardTitle>Listado de clientes</CardTitle>
			</CardHeader>
			<CardContent class="p-0">
				<div class="overflow-x-auto w-full">
					<table class="w-full text-sm text-left text-zinc-300">
						<thead class="text-xs uppercase bg-zinc-950 text-zinc-500 border-b border-zinc-900 tracking-wider">
							<tr>
								<th class="px-6 py-4 font-bold">Tipo</th>
								<th class="px-6 py-4 font-bold">Nombre</th>
								<th class="px-6 py-4 font-bold">Alias / RNC</th>
								<th class="px-6 py-4 font-bold">Contacto</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-zinc-900/60">
							{#if clients.length === 0}
								<tr>
									<td colspan="4" class="px-6 py-12 text-center text-zinc-500 text-xs">Aún no hay clientes registrados.</td>
								</tr>
							{:else}
						{#each clients as client (client.id)}
									<tr class="hover:bg-zinc-900/35 transition-colors duration-150">
										<td class="px-6 py-4 whitespace-nowrap">
											{#if client.client_type === 'company'}
												<Badge variant="info">Empresa</Badge>
											{:else}
												<Badge variant="secondary">Persona</Badge>
											{/if}
										</td>
										<td class="px-6 py-4">
											<div class="space-y-0.5">
												<p class="font-semibold text-zinc-100">{client.client_type === 'company' ? client.company_name : client.full_name}</p>
								<p class="text-[11px] text-zinc-500">{client.client_type === 'company' ? client.full_name : 'Cliente persona'}</p>
											</div>
										</td>
										<td class="px-6 py-4 whitespace-nowrap text-xs text-zinc-400">
											{client.client_type === 'company' ? `${client.alias} / ${client.rnc}` : '—'}
										</td>
										<td class="px-6 py-4 text-xs text-zinc-400">
											<div class="space-y-0.5">
												<p>{client.email || 'Sin correo'}</p>
												<p>{client.phone || 'Sin teléfono'}</p>
											</div>
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
