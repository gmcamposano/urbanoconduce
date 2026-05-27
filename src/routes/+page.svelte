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

	let errorMessage = $derived(form?.error ?? '');
</script>

<svelte:head>
	<title>{activeTab === 'login' ? 'Sign In' : 'Sign Up'} - InvoiceFlow</title>
</svelte:head>

<div class="flex-1 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
	<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[450px] bg-indigo-600/10 blur-[80px] rounded-full pointer-events-none"></div>

	<div class="flex items-center gap-2 mb-8 relative z-10">
		<div class="bg-indigo-600/15 p-2 rounded-lg border border-indigo-500/20">
			<FileText class="h-6 w-6 text-indigo-400" />
		</div>
		<span class="font-black text-xl tracking-tight text-white">Invoice<span class="text-indigo-400">Flow</span></span>
	</div>

	<Card class="w-full max-w-md relative z-10 border-zinc-800 bg-zinc-950/75 shadow-2xl backdrop-blur-lg">
		<div class="flex border-b border-zinc-900 bg-zinc-900/10">
			<button
				class="flex-1 py-4 text-sm font-semibold text-center border-b-2 transition-all duration-200 cursor-pointer {activeTab === 'login' ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-zinc-500 hover:text-zinc-300'}"
				onclick={() => {
					activeTab = 'login';
					errorMessage = '';
				}}
			>
				<div class="flex items-center justify-center gap-2">
					<LogIn class="h-4 w-4" />
					Sign In
				</div>
			</button>
			<button
				class="flex-1 py-4 text-sm font-semibold text-center border-b-2 transition-all duration-200 cursor-pointer {activeTab === 'register' ? 'border-indigo-500 text-white bg-indigo-500/5' : 'border-transparent text-zinc-500 hover:text-zinc-300'}"
				onclick={() => {
					activeTab = 'register';
					errorMessage = '';
				}}
			>
				<div class="flex items-center justify-center gap-2">
					<UserPlus class="h-4 w-4" />
					Register
				</div>
			</button>
		</div>

		<CardHeader class="pb-2">
			<CardTitle class="text-xl text-center">
				{activeTab === 'login' ? 'Welcome Back' : 'Create an Account'}
			</CardTitle>
			<p class="text-zinc-500 text-xs text-center mt-1">
				{activeTab === 'login' ? 'Sign in to manage and view organization invoices.' : 'Configure your name, email and role for access.'}
			</p>
		</CardHeader>

		<CardContent class="p-6">
			{#if form?.success}
				<div class="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg text-sm text-emerald-400 mb-6 flex items-start gap-2.5">
					<svg class="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<div>
						<p class="font-bold">Success</p>
						<p class="text-xs text-zinc-400 mt-0.5">{form.message}</p>
					</div>
				</div>
			{/if}

			{#if errorMessage}
				<div class="bg-rose-500/10 border border-rose-500/20 p-4 rounded-lg text-sm text-rose-400 mb-6 flex items-start gap-2.5">
					<svg class="h-5 w-5 text-rose-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
					<div>
						<p class="font-bold">Authentication Failed</p>
						<p class="text-xs text-zinc-400 mt-0.5">{errorMessage}</p>
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
					<Input label="Email Address" name="email" type="email" placeholder="name@company.com" required autocomplete="email" disabled={loading} />

					<div class="relative">
						<Input
							label="Password"
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

					<Button type="submit" class="w-full mt-2 font-bold" disabled={loading}>
						{#if loading}
							<div class="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
							Signing In...
						{:else}
							Sign In
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
					<Input label="Full Name" name="name" type="text" placeholder="Jane Doe" required disabled={loading} />

					<Input label="Email Address" name="email" type="email" placeholder="name@company.com" required disabled={loading} />

					<div class="relative">
						<Input
							label="Password"
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
						<Select label="Assigned System Role" name="role" required disabled={loading}>
							<option value="viewer" class="bg-zinc-950 text-zinc-100">Viewer (Read Only)</option>
							<option value="editor" class="bg-zinc-950 text-zinc-100">Editor (Create & Edit)</option>
							<option value="admin" class="bg-zinc-950 text-zinc-100">Admin (Full Control)</option>
						</Select>

						<div class="flex gap-2 bg-indigo-500/5 border border-indigo-500/10 p-3 rounded-lg text-[11px] text-zinc-400">
							<Shield class="h-4 w-4 text-indigo-400 flex-shrink-0" />
							<p>Choosing a role during registration is enabled for development/review only.</p>
						</div>
					{/if}

					<Button type="submit" class="w-full mt-2 font-bold" disabled={loading}>
						{#if loading}
							<div class="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
							Creating Account...
						{:else}
							Create Account
						{/if}
					</Button>
				</form>
			{/if}
		</CardContent>
	</Card>
</div>
