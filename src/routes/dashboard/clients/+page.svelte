<script lang="ts">
	import { enhance } from '$app/forms';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import { Contact, Edit3, Trash2, Users } from '@lucide/svelte';

	let { data, form } = $props();

	const profile = $derived(data.profile);
	const canManage = $derived(profile?.role === 'admin' || profile?.role === 'editor');
	const clients = $derived(data.clients || []);

	let loading = $state(false);
	let editingClient = $state<{
		id: string;
		client_type: 'person' | 'company';
		full_name: string | null;
		alias: string | null;
		rnc: string | null;
		company_name: string | null;
		email: string | null;
	} | null>(null);
	let editLoading = $state(false);
	let clientType = $state<'person' | 'company'>('person');
	let fullName = $state('');
	let alias = $state('');
	let rnc = $state('');
	let companyName = $state('');
	let clientToDelete = $state<{ id: string; name: string } | null>(null);
	let deleteLoading = $state(false);

	function trimCompanyFormData(formData: FormData) {
		const v = formData.get('alias');
		if (typeof v === 'string') formData.set('alias', v.trim());
		const r = formData.get('rnc');
		if (typeof r === 'string') formData.set('rnc', r.trim());
		const c = formData.get('company_name');
		if (typeof c === 'string') formData.set('company_name', c.trim());
	}

	function handleCreateSubmit({ formData }: { formData: FormData }) {
		trimCompanyFormData(formData);
		loading = true;
		return async ({ result, update }: { result: any; update: () => Promise<void> }) => {
			loading = false;
			if (result.type === 'success') {
				resetForm();
			}
			await update();
		};
	}

	function handleEditSubmit({ formData }: { formData: FormData }) {
		trimCompanyFormData(formData);
		editLoading = true;
		return async ({ result, update }: { result: any; update: () => Promise<void> }) => {
			editLoading = false;
			if (result.type === 'success') {
				closeEditDialog();
			}
			await update();
		};
	}

	function startEditing(client: (typeof clients)[number]) {
		editingClient = { ...client };
		clientType = client.client_type;
		fullName = client.full_name || '';
		alias = client.alias || '';
		rnc = client.rnc || '';
		companyName = client.company_name || '';
	}

	function closeEditDialog() {
		editingClient = null;
		clientType = 'person';
		fullName = '';
		alias = '';
		rnc = '';
		companyName = '';
		editLoading = false;
	}

	function openDeleteDialog(client: (typeof clients)[number]) {
		clientToDelete = {
			id: client.id,
			name:
				client.client_type === 'company'
					? client.company_name || client.alias || 'Empresa sin nombre'
					: client.full_name || 'Cliente sin nombre'
		};
	}

	function closeDeleteDialog() {
		clientToDelete = null;
		deleteLoading = false;
	}

	function handleDeleteSubmit() {
		deleteLoading = true;
		return async ({ result, update }: { result: any; update: () => Promise<void> }) => {
			deleteLoading = false;
			if (result.type === 'success') {
				closeDeleteDialog();
			}
			await update();
		};
	}

	function resetForm() {
		clientType = 'person';
		fullName = '';
		alias = '';
		rnc = '';
		companyName = '';
	}
</script>

<svelte:head>
	<title>Clientes - magikalConduce | magikalInvoice</title>
</svelte:head>

<div class="flex flex-1 flex-col justify-start space-y-6 text-[#171717]">
	<div class="border-b border-[#ededed] pb-5">
		<h1 class="flex items-center gap-2 text-2xl font-medium tracking-tight text-[#171717]">
			<Users class="h-6 w-6 text-[#3ecf8e]" />
			Clientes
		</h1>
		<p class="mt-0.5 text-xs text-[#707070]">
			Registra personas o empresas para reutilizarlas en tus facturas.
		</p>
	</div>

	{#if form?.error}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a] shadow-sm"
		>
			<Contact class="mt-0.5 h-5 w-5 flex-shrink-0" />
			<div>
				<p class="font-medium">No se pudo guardar el cliente</p>
				<p class="mt-0.5 text-xs text-[#707070]">{form.error}</p>
			</div>
		</div>
	{/if}

	{#if form?.success}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-[#3ecf8e]/25 bg-[#3ecf8e]/12 p-4 text-sm text-[#171717] shadow-sm"
		>
			<Contact class="mt-0.5 h-5 w-5 flex-shrink-0 text-[#24b47e]" />
			<div>
				<p class="font-medium">{form.message || 'Cliente guardado'}</p>
				<p class="mt-0.5 text-xs text-[#707070]">El registro quedó disponible en el listado.</p>
			</div>
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
		<Card class="xl:col-span-1">
			<CardHeader>
				<CardTitle>Nuevo cliente</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					action="?/createClient"
					method="POST"
					class="space-y-4"
					use:enhance={handleCreateSubmit}
				>
					<Select
						label="Tipo de cliente"
						name="client_type"
						bind:value={clientType}
						required
						disabled={loading}
					>
						<option value="person">Persona</option>
						<option value="company">Empresa</option>
					</Select>

					{#if clientType === 'person'}
						<Input
							label="Nombre completo"
							name="full_name"
							type="text"
							placeholder="Juan Pérez"
							bind:value={fullName}
							required
							disabled={loading}
						/>
					{:else}
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<Input
								label="Alias"
								name="alias"
								type="text"
								placeholder="CCARIBE"
								bind:value={alias}
								required
								disabled={loading}
							/>
							<Input
								label="RNC"
								name="rnc"
								type="text"
								placeholder="1-01-12345-6"
								bind:value={rnc}
								required
								disabled={loading}
							/>
						</div>
						<Input
							label="Nombre de empresa"
							name="company_name"
							type="text"
							placeholder="Constructora del Caribe SRL"
							bind:value={companyName}
							required
							disabled={loading}
						/>
					{/if}

					<div
						class="flex items-center gap-2 rounded-lg border border-[#ededed] bg-[#fafafa] p-3 text-[11px] text-[#707070]"
					>
						<Contact class="h-4 w-4 flex-shrink-0 text-[#3ecf8e]" />
						<p>
							{clientType === 'company'
								? 'La empresa requiere alias, RNC y nombre de empresa.'
								: 'La persona sólo requiere el nombre completo.'}
						</p>
					</div>

					<div class="flex gap-3">
						<Button type="submit" class="flex-1" disabled={loading}>Guardar cliente</Button>
					</div>
				</form>
			</CardContent>
		</Card>

		<Card class="xl:col-span-2">
			<CardHeader>
				<CardTitle>Listado de clientes</CardTitle>
			</CardHeader>
			<CardContent class="p-0">
				<div class="w-full overflow-x-auto">
					<table class="w-full text-left text-sm text-[#171717]">
						<thead
							class="border-b border-[#ededed] bg-[#fafafa] text-xs tracking-wider text-[#707070] uppercase"
						>
							<tr>
								<th class="px-6 py-4 font-bold">Tipo</th>
								<th class="px-6 py-4 font-bold">Nombre / Empresa</th>
								<th class="px-6 py-4 font-bold">Alias / RNC</th>
								{#if canManage}
									<th class="px-6 py-4 text-right font-bold">Acciones</th>
								{/if}
							</tr>
						</thead>
						<tbody class="divide-y divide-[#ededed]">
							{#if clients.length === 0}
								<tr>
									<td
										colspan={canManage ? 4 : 3}
										class="px-6 py-12 text-center text-xs text-[#707070]"
										>Aún no hay clientes registrados.</td
									>
								</tr>
							{:else}
								{#each clients as client (client.id)}
									<tr class="transition-colors duration-150 hover:bg-[#fafafa]">
										<td class="px-6 py-4 whitespace-nowrap">
											{#if client.client_type === 'company'}
												<Badge variant="info">Empresa</Badge>
											{:else}
												<Badge variant="secondary">Persona</Badge>
											{/if}
										</td>
										<td class="px-6 py-4">
											<div class="space-y-0.5">
												<p class="font-medium text-[#171717]">
													{client.client_type === 'company'
														? client.company_name
														: client.full_name}
												</p>
												<p class="text-[11px] text-[#707070]">
													{client.client_type === 'company' ? 'Cliente empresa' : 'Cliente persona'}
												</p>
											</div>
										</td>
										<td class="px-6 py-4 text-xs whitespace-nowrap text-[#707070]">
											{client.client_type === 'company' ? `${client.alias} / ${client.rnc}` : '—'}
										</td>
										{#if canManage}
											<td class="px-6 py-4 text-right whitespace-nowrap">
												<div class="flex items-center justify-end gap-1.5">
													<Button
														variant="ghost"
														size="icon"
														class="h-8 w-8 text-[#707070] hover:text-[#171717]"
														title="Editar cliente"
														onclick={() => startEditing(client)}
													>
														<Edit3 class="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														class="h-8 w-8 text-[#707070] hover:text-[#e2005a]"
														title="Borrar cliente"
														onclick={() => openDeleteDialog(client)}
													>
														<Trash2 class="h-4 w-4" />
													</Button>
												</div>
											</td>
										{/if}
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

{#if editingClient}
	<Dialog
		open
		title="Editar cliente"
		description="Actualiza los datos del cliente antes de guardarlo."
		class="max-w-xl"
		onClose={closeEditDialog}
	>
		<form
			id="edit-client-form"
			action="?/updateClient"
			method="POST"
			class="space-y-4"
			use:enhance={handleEditSubmit}
		>
			<input type="hidden" name="id" value={editingClient.id} />

			<Select
				label="Tipo de cliente"
				name="client_type"
				bind:value={clientType}
				required
				disabled={editLoading}
			>
				<option value="person">Persona</option>
				<option value="company">Empresa</option>
			</Select>

			{#if clientType === 'person'}
				<Input
					label="Nombre completo"
					name="full_name"
					type="text"
					placeholder="Juan Pérez"
					bind:value={fullName}
					required
					disabled={editLoading}
				/>
			{:else}
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Input
						label="Alias"
						name="alias"
						type="text"
						placeholder="CCARIBE"
						bind:value={alias}
						required
						disabled={editLoading}
					/>
					<Input
						label="RNC"
						name="rnc"
						type="text"
						placeholder="1-01-12345-6"
						bind:value={rnc}
						required
						disabled={editLoading}
					/>
				</div>
				<Input
					label="Nombre de empresa"
					name="company_name"
					type="text"
					placeholder="Constructora del Caribe SRL"
					bind:value={companyName}
					required
					disabled={editLoading}
				/>
			{/if}

			<div
				class="flex items-center gap-2 rounded-lg border border-[#ededed] bg-[#fafafa] p-3 text-[11px] text-[#707070]"
			>
				<Contact class="h-4 w-4 flex-shrink-0 text-[#3ecf8e]" />
				<p>
					{clientType === 'company'
						? 'La empresa requiere alias, RNC y nombre de empresa.'
						: 'La persona sólo requiere el nombre completo.'}
				</p>
			</div>
		</form>

		{#snippet footer()}
			<Button type="button" variant="outline" disabled={editLoading} onclick={closeEditDialog}
				>Cancelar</Button
			>
			<Button type="submit" form="edit-client-form" disabled={editLoading}>
				{#if editLoading}
					Guardando...
				{:else}
					Guardar cambios
				{/if}
			</Button>
		{/snippet}
	</Dialog>
{/if}

{#if clientToDelete}
	<Dialog
		open
		title="Confirmar eliminación"
		description="Esta acción no se puede deshacer."
		class="max-w-md"
		onClose={closeDeleteDialog}
	>
		<div class="space-y-3">
			<p class="text-sm leading-relaxed text-[#707070]">
				¿Seguro que deseas eliminar el cliente <strong class="text-[#171717]"
					>{clientToDelete.name}</strong
				>? El registro desaparecerá del listado.
			</p>

<form
				id="delete-client-form"
				action="?/deleteClient"
				method="POST"
				use:enhance={handleDeleteSubmit}
			>
				<input type="hidden" name="id" value={clientToDelete.id} />
			</form>
		</div>

		{#snippet footer()}
			<Button type="button" variant="outline" disabled={deleteLoading} onclick={closeDeleteDialog}
				>Cancelar</Button
			>
			<Button
				type="submit"
				form="delete-client-form"
				variant="destructive"
				disabled={deleteLoading}
			>
				{#if deleteLoading}
					Eliminando...
				{:else}
					Eliminar
				{/if}
			</Button>
		{/snippet}
	</Dialog>
{/if}
