<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
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

		return () => {
			subscription.unsubscribe();
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
