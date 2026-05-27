<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { Palette, Droplets } from '@lucide/svelte';

	let { data, form } = $props();

	const colors = $derived(data.colors || []);

	let loading = $state(false);
</script>

<svelte:head>
	<title>Colores - FacturaFlow</title>
</svelte:head>

<div class="space-y-6 flex-1 flex flex-col justify-start text-[#171717]">
	<div class="border-b border-[#ededed] pb-5">
		<h1 class="text-2xl font-medium text-[#171717] tracking-tight flex items-center gap-2">
			<Palette class="h-6 w-6 text-[#3ecf8e]" />
			Colores
		</h1>
		<p class="text-[#707070] text-xs mt-0.5">Define los colores disponibles para asignar a productos.</p>
	</div>

	{#if form?.error}
		<div class="bg-[#e2005a]/10 border border-[#e2005a]/20 p-4 rounded-xl text-sm text-[#e2005a] flex items-start gap-2.5 shadow-sm">
			<Droplets class="h-5 w-5 flex-shrink-0 mt-0.5" />
			<div>
				<p class="font-medium">No se pudo guardar el color</p>
				<p class="text-xs text-[#707070] mt-0.5">{form.error}</p>
			</div>
		</div>
	{/if}

	{#if form?.success}
		<div class="bg-[#3ecf8e]/12 border border-[#3ecf8e]/25 p-4 rounded-xl text-sm text-[#171717] flex items-start gap-2.5 shadow-sm">
			<Droplets class="h-5 w-5 flex-shrink-0 mt-0.5 text-[#24b47e]" />
			<div>
				<p class="font-medium">Color guardado</p>
				<p class="text-xs text-[#707070] mt-0.5">Ya está disponible para productos.</p>
			</div>
		</div>
	{/if}

	<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
		<Card class="xl:col-span-1">
			<CardHeader>
				<CardTitle>Nuevo color</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					action="?/createColor"
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
					<Input
						label="Color"
						name="color"
						type="text"
						placeholder="Azul, ciruela, verde oliva"
						class="capitalize"
						required
						disabled={loading}
					/>

					<div class="flex items-center gap-3 rounded-[6px] border border-[#ededed] bg-[#fafafa] px-3 py-2 text-xs text-[#707070]">
						<span class="inline-flex h-5 items-center rounded-[4px] border border-[#dfdfdf] bg-white px-2 font-mono text-[10px] text-[#171717]">Texto</span>
						<p>Escribe el nombre del color manualmente, por ejemplo azul o ciruela.</p>
					</div>

					<Button type="submit" class="w-full" disabled={loading}>Guardar color</Button>
				</form>
			</CardContent>
		</Card>

		<Card class="xl:col-span-2">
			<CardHeader>
				<CardTitle>Colores disponibles</CardTitle>
			</CardHeader>
			<CardContent class="p-0">
				<div class="overflow-x-auto w-full">
					<table class="w-full text-sm text-left text-[#171717]">
						<thead class="text-xs uppercase bg-[#fafafa] text-[#707070] border-b border-[#ededed] tracking-wider">
							<tr>
								<th class="px-6 py-4 font-bold w-16">#</th>
								<th class="px-6 py-4 font-bold">Color</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[#ededed]">
							{#if colors.length === 0}
								<tr>
									<td colspan="2" class="px-6 py-12 text-center text-[#707070] text-xs">Aún no hay colores registrados.</td>
								</tr>
							{:else}
								{#each colors as item, index (item.id)}
									<tr class="hover:bg-[#fafafa] transition-colors duration-150">
										<td class="px-6 py-4 font-mono text-xs text-[#707070]">{index + 1}</td>
						<td class="px-6 py-4 text-xs text-[#171717] capitalize">{item.color}</td>
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
