<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import { dev } from '$app/environment';
	import { FileText, LogIn, UserPlus, Shield, Eye, EyeOff } from '@lucide/svelte';

	type LoginFormState = {
		error?: string;
		success?: boolean;
		message?: string;
	};

	// Page form properties passed from the action
	let { form }: { form?: LoginFormState } = $props();

	let activeTab = $state<'login' | 'register'>('login');
	let showPassword = $state(false);
	let loading = $state(false);

	// Form values (for local bindings)
	let email = $state('');
	let password = $state('');
	let name = $state('');
	let role = $state<'admin' | 'editor' | 'viewer'>('editor');
</script>

<svelte:head>
	<title>{activeTab === 'login' ? 'Iniciar sesión' : 'Crear cuenta'} - FacturaFlow</title>
</svelte:head>

<div class="flex-1 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
	<!-- Ambient glow behind the login box -->
	<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[450px] bg-indigo-600/10 blur-[80px] rounded-full pointer-events-none"></div>

	<!-- Logo Header -->
	<div class="flex items-center gap-2 mb-8 relative z-10">
		<div class="bg-indigo-600/15 p-2 rounded-lg border border-indigo-500/20">
			<FileText class="h-6 w-6 text-indigo-400" />
		</div>
		<span class="font-black text-xl tracking-tight text-white">Factura<span class="text-indigo-400">Flow</span></span>
	</div>

	<!-- Main Auth Card -->
	<Card class="w-full max-w-md relative z-10 border-zinc-800 bg-zinc-950/75 shadow-2xl backdrop-blur-lg">
		<!-- Tabs -->
		<div class="flex border-b border-zinc-900 bg-zinc-900/10">
			<button
				class="flex-1 py-4 text-sm font-semibold text-center border-b-2 transition-all duration-200 cursor-pointer {activeTab === 'login' ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-zinc-500 hover:text-zinc-300'}"
				onclick={() => { activeTab = 'login'; }}
			>
				<div class="flex items-center justify-center gap-2">
					<LogIn class="h-4 w-4" />
					Iniciar sesión
				</div>
			</button>
			<button
				class="flex-1 py-4 text-sm font-semibold text-center border-b-2 transition-all duration-200 cursor-pointer {activeTab === 'register' ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-zinc-500 hover:text-zinc-300'}"
				onclick={() => { activeTab = 'register'; }}
			>
				<div class="flex items-center justify-center gap-2">
					<UserPlus class="h-4 w-4" />
					Registrarse
				</div>
			</button>
		</div>

		<CardHeader class="pb-2">
			<CardTitle class="text-xl text-center">
				{activeTab === 'login' ? 'Bienvenido de nuevo' : 'Crear una cuenta'}
			</CardTitle>
			<p class="text-zinc-500 text-xs text-center mt-1">
				{activeTab === 'login' ? 'Accede para gestionar y revisar las facturas de la organización.' : 'Configura tu nombre, correo y rol de acceso.'}
			</p>
		</CardHeader>

		<CardContent class="p-6">
			<!-- Success feedback from signUp -->
			{#if form?.success}
				<div class="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg text-sm text-emerald-400 mb-6 flex items-start gap-2.5">
					<svg class="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<div>
					<p class="font-bold">Éxito</p>
						<p class="text-xs text-zinc-400 mt-0.5">{form.message}</p>
					</div>
				</div>
			{/if}

			<!-- Error Feedback -->
			{#if form?.error}
				<div class="bg-rose-500/10 border border-rose-500/20 p-4 rounded-lg text-sm text-rose-400 mb-6 flex items-start gap-2.5">
					<svg class="h-5 w-5 text-rose-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
					<div>
					<p class="font-bold">La autenticación falló</p>
						<p class="text-xs text-zinc-400 mt-0.5">{form.error}</p>
					</div>
				</div>
			{/if}

			{#if activeTab === 'login'}
				<!-- LOGIN FORM -->
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
							class="absolute top-7.5 right-3 text-zinc-500 hover:text-zinc-300 cursor-pointer"
							onclick={() => (showPassword = !showPassword)}
						>
							{#if showPassword}
								<EyeOff class="h-4 w-4" />
							{:else}
								<Eye class="h-4 w-4" />
							{/if}
						</button>
					</div>

					<Button
						type="submit"
						class="w-full mt-2 font-bold"
						disabled={loading}
					>
						{#if loading}
							<div class="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
							Iniciando sesión...
						{:else}
							Iniciar sesión
						{/if}
					</Button>
				</form>
			{:else}
				<!-- REGISTER FORM -->
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
							class="absolute top-7.5 right-3 text-zinc-500 hover:text-zinc-300 cursor-pointer"
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
						<!-- Role selection for testing environment -->
						<Select
							label="Rol del sistema"
							name="role"
							required
							disabled={loading}
						>
							<option value="viewer" class="bg-zinc-950 text-zinc-100">Lector (solo lectura)</option>
							<option value="editor" class="bg-zinc-950 text-zinc-100">Editor (crear y editar)</option>
							<option value="admin" class="bg-zinc-950 text-zinc-100">Administrador (control total)</option>
						</Select>

						<!-- Info Tip -->
						<div class="flex gap-2 bg-indigo-500/5 border border-indigo-500/10 p-3 rounded-lg text-[11px] text-zinc-400">
							<Shield class="h-4 w-4 text-indigo-400 flex-shrink-0" />
							<p>La selección de rol al registrarse está habilitada sólo para desarrollo o revisión.</p>
						</div>
					{/if}

					<Button
						type="submit"
						class="w-full mt-2 font-bold"
						disabled={loading}
					>
						{#if loading}
							<div class="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
							Creando cuenta...
						{:else}
							Crear cuenta
						{/if}
					</Button>
				</form>
			{/if}
		</CardContent>
	</Card>

	<!-- Back link -->
	<a href={resolve('/')} class="text-zinc-500 hover:text-zinc-300 text-xs font-semibold mt-6 relative z-10 transition-all duration-200">
		← Volver al inicio
	</a>
</div>
