<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { updated } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import RouteLoadingBar from '$lib/components/RouteLoadingBar.svelte';

	let { children } = $props();

	onMount(() => {
		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((event) => {
			if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
				invalidateAll();
			}
		});

		const reloadIfUpdated = async () => {
			try {
				if (await updated.check()) {
					window.location.reload();
				}
			} catch {
				// ignore version check failures
			}
		};

		const onVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				void reloadIfUpdated();
			}
		};

		const onUnhandledRejection = (event: PromiseRejectionEvent) => {
			const message =
				typeof event.reason === 'string'
					? event.reason
					: event.reason instanceof Error
						? event.reason.message
						: '';

			if (message.includes('Failed to fetch dynamically imported module')) {
				window.location.reload();
			}
		};

		document.addEventListener('visibilitychange', onVisibilityChange);
		window.addEventListener('unhandledrejection', onUnhandledRejection);
		void reloadIfUpdated();

		return () => {
			subscription.unsubscribe();
			document.removeEventListener('visibilitychange', onVisibilityChange);
			window.removeEventListener('unhandledrejection', onUnhandledRejection);
		};
	});
</script>

<svelte:head>
	<title>magikalInvoices - Generador profesional de facturas</title>
</svelte:head>

<div class="relative flex min-h-screen flex-col bg-white text-[#171717]">
	<RouteLoadingBar />
	{@render children()}
</div>
