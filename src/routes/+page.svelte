<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import { dev } from '$app/environment';
	import { FileText, LogIn, UserPlus, Shield, Eye, EyeOff } from '@lucide/svelte';

	let { form } = $props();

	let activeTab = $state<'login' | 'register'>('login');
	let showPassword = $state(false);
	let loading = $state(false);
</script>

<svelte:head>
	<title>{activeTab === 'login' ? 'Iniciar sesión' : 'Crear cuenta'} - magikalInvoice</title>
</svelte:head>

<div
	class="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] px-4 py-16"
>
	<div class="relative z-10 mb-10 flex items-center gap-2">
		<div class="rounded-md border border-[#24b47e] bg-[#3ecf8e] p-2 shadow-sm">
			<FileText class="h-6 w-6 text-[#171717]" />
		</div>
		<span class="text-xl font-medium tracking-tight text-[#171717]"
			>Factura<span class="text-[#3ecf8e]">Flow</span></span
		>
	</div>

	<Card class="relative z-10 w-full max-w-md">
		<div class="flex border-b border-[#ededed] bg-white">
			<button
				class="flex-1 cursor-pointer border-b-2 py-4 text-center text-sm font-medium transition-colors duration-200 {activeTab ===
				'login'
					? 'border-[#3ecf8e] bg-[#fafafa] text-[#171717]'
					: 'border-transparent text-[#707070] hover:text-[#171717]'}"
				onclick={() => {
					activeTab = 'login';
				}}
			>
				<div class="flex items-center justify-center gap-2">
					<LogIn class="h-4 w-4" />
					Iniciar sesión
				</div>
			</button>
			<button
				class="flex-1 cursor-pointer border-b-2 py-4 text-center text-sm font-medium transition-colors duration-200 {activeTab ===
				'register'
					? 'border-[#3ecf8e] bg-[#fafafa] text-[#171717]'
					: 'border-transparent text-[#707070] hover:text-[#171717]'}"
				onclick={() => {
					activeTab = 'register';
				}}
			>
				<div class="flex items-center justify-center gap-2">
					<UserPlus class="h-4 w-4" />
					Registrarse
				</div>
			</button>
		</div>

		<CardHeader class="pb-2">
			<CardTitle class="text-center text-xl">
				{activeTab === 'login' ? 'Bienvenido de nuevo' : 'Crear una cuenta'}
			</CardTitle>
			<p class="mt-1 text-center text-xs text-[#707070]">
				{activeTab === 'login'
					? 'Accede para gestionar y revisar las facturas de la organización.'
					: 'Configura tu nombre, correo y rol de acceso.'}
			</p>
		</CardHeader>

		<CardContent class="p-6">
			{#if form?.success}
				<div
					class="mb-6 flex items-start gap-2.5 rounded-lg border border-[#3ecf8e]/25 bg-[#3ecf8e]/12 p-4 text-sm text-[#171717]"
				>
					<svg
						class="mt-0.5 h-5 w-5 shrink-0 text-[#24b47e]"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<div>
						<p class="font-medium">Éxito</p>
						<p class="mt-0.5 text-xs text-[#707070]">{form.message}</p>
					</div>
				</div>
			{/if}

			{#if form?.error}
				<div
					class="mb-6 flex items-start gap-2.5 rounded-lg border border-[#e2005a]/20 bg-[#e2005a]/10 p-4 text-sm text-[#e2005a]"
				>
					<svg
						class="mt-0.5 h-5 w-5 shrink-0 text-[#e2005a]"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					<div>
						<p class="font-medium">La autenticación falló</p>
						<p class="mt-0.5 text-xs text-[#707070]">{form.error}</p>
					</div>
				</div>
			{/if}

			{#if activeTab === 'login'}
				<form
					action="?/login"
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
						label="Correo electrónico"
						name="email"
						type="email"
						placeholder="nombre@empresa.com"
						required
						autocomplete="email"
						disabled={loading}
					/>

					<div class="relative">
						<Input
							label="Contraseña"
							name="password"
							type={showPassword ? 'text' : 'password'}
							placeholder="••••••••"
							required
							autocomplete="current-password"
							disabled={loading}
						/>
						<button
							type="button"
							class="absolute top-7 right-3 cursor-pointer text-[#9a9a9a] hover:text-[#171717]"
							onclick={() => (showPassword = !showPassword)}
						>
							{#if showPassword}
								<EyeOff class="h-4 w-4" />
							{:else}
								<Eye class="h-4 w-4" />
							{/if}
						</button>
					</div>

					<Button type="submit" class="mt-2 w-full" disabled={loading}>
						{#if loading}
							<div
								class="h-4 w-4 animate-spin rounded-full border-2 border-[#171717]/20 border-t-[#171717]"
							></div>
							Iniciando sesión...
						{:else}
							Iniciar sesión
						{/if}
					</Button>
				</form>
			{:else}
				<form
					action="?/register"
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
						label="Nombre completo"
						name="name"
						type="text"
						placeholder="Juan Pérez"
						required
						disabled={loading}
					/>

					<Input
						label="Correo electrónico"
						name="email"
						type="email"
						placeholder="nombre@empresa.com"
						required
						disabled={loading}
					/>

					<div class="relative">
						<Input
							label="Contraseña"
							name="password"
							type={showPassword ? 'text' : 'password'}
							placeholder="••••••••"
							required
							disabled={loading}
						/>
						<button
							type="button"
							class="absolute top-7 right-3 cursor-pointer text-[#9a9a9a] hover:text-[#171717]"
							onclick={() => (showPassword = !showPassword)}
						>
							{#if showPassword}
								<EyeOff class="h-4 w-4" />
							{:else}
								<Eye class="h-4 w-4" />
							{/if}
						</button>
					</div>

					{#if dev}
						<Select label="Rol del sistema" name="role" required disabled={loading}>
							<option value="viewer">Lector (solo lectura)</option>
							<option value="editor">Editor (crear y editar)</option>
							<option value="admin">Administrador (control total)</option>
						</Select>

						<div
							class="flex gap-2 rounded-lg border border-[#ededed] bg-[#fafafa] p-3 text-[11px] text-[#707070]"
						>
							<Shield class="h-4 w-4 shrink-0 text-[#3ecf8e]" />
							<p>
								La selección de rol al registrarse está habilitada sólo para desarrollo o revisión.
							</p>
						</div>
					{/if}

					<Button type="submit" class="mt-2 w-full" disabled={loading}>
						{#if loading}
							<div
								class="h-4 w-4 animate-spin rounded-full border-2 border-[#171717]/20 border-t-[#171717]"
							></div>
							Creando cuenta...
						{:else}
							Crear cuenta
						{/if}
					</Button>
				</form>
			{/if}
		</CardContent>
	</Card>
</div>
