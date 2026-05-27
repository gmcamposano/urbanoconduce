<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import CardHeader from '$lib/components/ui/CardHeader.svelte';
	import CardTitle from '$lib/components/ui/CardTitle.svelte';
	import CardContent from '$lib/components/ui/CardContent.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import { SvelteDate } from 'svelte/reactivity';
	import { 
		Plus, 
		Trash2, 
		ArrowLeft, 
		Calculator, 
		FileText,
		Save,
		DollarSign
	} from '@lucide/svelte';

	let { data, form } = $props();

	// Set up date defaults
	const today = new SvelteDate();
	const formattedToday = today.toISOString().split('T')[0];
	
	const thirtyDaysLater = new SvelteDate(today);
	thirtyDaysLater.setDate(today.getDate() + 30);
	const formattedDue = thirtyDaysLater.toISOString().split('T')[0];

	// Form field reactive states
	let invoiceNumber = $state('');
	let clientName = $state('');
	let clientEmail = $state('');
	let invoiceDate = $state(formattedToday);
	let dueDate = $state(formattedDue);
	let status = $state<'draft' | 'pending'>('pending');
	let notes = $state('');
	let taxRate = $state<number>(0);
	let discountAmount = $state<number>(0);

	// Line items state
	let items = $state<Array<{ id: string; description: string; quantity: number; unit_price: number }>>([
		{ id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0 }
	]);

	let loading = $state(false);

	// Subtotal calculations (derived)
	const subtotal = $derived(
		items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0)
	);
	
	const taxAmount = $derived(
		subtotal * ((Number(taxRate) || 0) / 100)
	);

	const totalAmount = $derived(
		Math.max(0, subtotal + taxAmount - (Number(discountAmount) || 0))
	);

	// Helpers to add or remove line items
	function addItem() {
		items.push({ id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0 });
	}

	function removeItem(id: string) {
		if (items.length > 1) {
			items = items.filter((item) => item.id !== id);
		}
	}

	// Formatter helper
	function formatCurrency(val: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
	}
</script>

<svelte:head>
	<title>New Invoice - InvoiceFlow</title>
</svelte:head>

<div class="space-y-6 max-w-4xl mx-auto flex-1 flex flex-col justify-start">
	<!-- Top back navigation link -->
	<div>
		<a href="/dashboard" class="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 font-semibold transition-all duration-200">
			<ArrowLeft class="h-3.5 w-3.5" />
			Back to Dashboard
		</a>
	</div>

	<!-- Header Title -->
	<div class="border-b border-zinc-900 pb-4">
		<h1 class="text-2xl font-black text-white tracking-tight flex items-center gap-2">
			<FileText class="h-6 w-6 text-indigo-500" />
			Create New Invoice
		</h1>
		<p class="text-zinc-500 text-xs mt-0.5">Fill out client info, line items, and taxes to publish a billing statement.</p>
	</div>

	<!-- Error Banner -->
	{#if form?.error}
		<div class="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl text-sm text-rose-400 flex items-start gap-2.5 shadow-lg shadow-rose-500/5">
			<svg class="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
			<div>
				<p class="font-bold">Error Publishing Invoice</p>
				<p class="text-xs text-zinc-400 mt-0.5">{form.error}</p>
			</div>
		</div>
	{/if}

	<!-- Create Form -->
	<form
		action="?/createInvoice"
		method="POST"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => {
				loading = false;
				await update();
			};
		}}
		class="space-y-6"
	>
		<!-- Serialize items array as a JSON string to submit through standard formData -->
		<input type="hidden" name="items" value={JSON.stringify(items)} />

		<Card class="border-zinc-800 bg-zinc-950/45">
			<CardHeader>
				<CardTitle>1. Primary Invoice Details</CardTitle>
			</CardHeader>
			<CardContent class="grid grid-cols-1 md:grid-cols-3 gap-5">
				<Input
					label="Invoice ID / Number"
					name="invoice_number"
					bind:value={invoiceNumber}
					placeholder={data.invoiceNumberPreview || 'INV-2026-0001'}
					required
					disabled={loading}
				/>
				
				<Select
					label="Status"
					name="status"
					bind:value={status}
					required
					disabled={loading}
				>
					<option value="pending" class="bg-zinc-950">Pending Approval</option>
					<option value="draft" class="bg-zinc-950">Draft (Unsent)</option>
				</Select>

				<Input
					label="Client Name"
					name="client_name"
					bind:value={clientName}
					placeholder="Client Company Inc."
					required
					disabled={loading}
				/>

				<Input
					label="Client Email"
					name="client_email"
					type="email"
					bind:value={clientEmail}
					placeholder="billing@client.com"
					required
					disabled={loading}
				/>

				<Input
					label="Invoice Date"
					name="invoice_date"
					type="date"
					bind:value={invoiceDate}
					required
					disabled={loading}
				/>

				<Input
					label="Due Date"
					name="due_date"
					type="date"
					bind:value={dueDate}
					required
					disabled={loading}
				/>
			</CardContent>
		</Card>

		<!-- Line Items Card -->
		<Card class="border-zinc-800 bg-zinc-950/45">
			<CardHeader class="flex flex-row justify-between items-center">
				<CardTitle>2. Billing Items</CardTitle>
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="flex items-center gap-1"
					onclick={addItem}
					disabled={loading}
				>
					<Plus class="h-3.5 w-3.5" />
					Add Row
				</Button>
			</CardHeader>
			<CardContent class="p-0">
				<div class="overflow-x-auto w-full">
					<table class="w-full text-sm text-left text-zinc-300">
						<thead class="text-xs uppercase bg-zinc-900/40 text-zinc-500 border-b border-zinc-900 tracking-wider">
							<tr>
								<th class="px-6 py-3 font-semibold w-1/2">Description</th>
								<th class="px-6 py-3 font-semibold w-1/6">Qty</th>
								<th class="px-6 py-3 font-semibold w-1/6">Unit Price</th>
								<th class="px-6 py-3 font-semibold w-1/6">Total</th>
								<th class="px-6 py-3 font-semibold text-right w-10"></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-zinc-900/60">
							{#each items as item (item.id)}
								<tr class="hover:bg-zinc-900/10">
									<td class="px-6 py-3">
										<input
											type="text"
											required
											placeholder="Item description (e.g. Website Consulting)"
											bind:value={item.description}
											disabled={loading}
							class="w-full bg-zinc-950/50 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500/50"
						/>
									</td>
									<td class="px-6 py-3">
										<input
											type="number"
											required
											min="1"
											step="any"
											bind:value={item.quantity}
											disabled={loading}
							class="w-full bg-zinc-950/50 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 text-center font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500/50"
						/>
									</td>
									<td class="px-6 py-3">
										<input
											type="number"
											required
											min="0"
											step="any"
											bind:value={item.unit_price}
											disabled={loading}
							class="w-full bg-zinc-950/50 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 text-right font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500/50"
						/>
									</td>
									<td class="px-6 py-3 text-right font-mono text-zinc-300 text-xs">
										{formatCurrency((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}
									</td>
									<td class="px-6 py-3 text-right">
										<Button
											type="button"
											variant="ghost"
											size="icon"
											class="h-7 w-7 text-zinc-500 hover:text-rose-400"
											disabled={items.length <= 1 || loading}
											onclick={() => removeItem(item.id)}
										>
											<Trash2 class="h-3.5 w-3.5" />
										</Button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>

		<!-- Bottom Calculation / Settings Grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
			<!-- Notes Card -->
			<Card class="border-zinc-800 bg-zinc-950/45">
				<CardHeader>
					<CardTitle>3. Terms & Notes</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="flex flex-col gap-1.5">
						<label for="notes" class="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Invoice Terms/Notes</label>
						<textarea
							id="notes"
							name="notes"
							rows="4"
							bind:value={notes}
							placeholder="Thank you for your business! Payment is due within 30 days via bank transfer."
							disabled={loading}
							class="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500 resize-none transition-all duration-200"
						></textarea>
					</div>
				</CardContent>
			</Card>

			<!-- Summary Pricing Card -->
			<Card class="border-indigo-900/30 bg-zinc-950/65 shadow-lg shadow-indigo-950/5 relative overflow-hidden">
				<div class="absolute top-0 right-0 h-32 w-32 bg-indigo-500/5 blur-[50px] rounded-full pointer-events-none"></div>
				<CardHeader>
					<CardTitle class="flex items-center gap-1.5">
						<Calculator class="h-4.5 w-4.5 text-indigo-400" />
						Summary & Totals
					</CardTitle>
				</CardHeader>
				<CardContent class="space-y-4">
					<!-- Tax & Discount inputs -->
					<div class="grid grid-cols-2 gap-4 border-b border-zinc-900 pb-4">
						<Input
							label="Tax Rate (%)"
							name="tax_rate"
							type="number"
							min="0"
							step="any"
							bind:value={taxRate}
							disabled={loading}
						/>
						
						<Input
							label="Discount ($)"
							name="discount_amount"
							type="number"
							min="0"
							step="any"
							bind:value={discountAmount}
							disabled={loading}
						/>
					</div>

					<!-- Pricing breakdown details -->
					<div class="space-y-2 text-sm text-zinc-400">
						<div class="flex justify-between">
							<span>Subtotal</span>
							<span class="font-mono text-zinc-200 font-semibold">{formatCurrency(subtotal)}</span>
						</div>
						<div class="flex justify-between">
							<span>Tax ({taxRate || 0}%)</span>
							<span class="font-mono text-zinc-200 font-semibold">{formatCurrency(taxAmount)}</span>
						</div>
						<div class="flex justify-between">
							<span>Discount</span>
							<span class="font-mono text-zinc-200 font-semibold">-{formatCurrency(discountAmount || 0)}</span>
						</div>
						
						<div class="flex justify-between text-base font-extrabold text-white pt-2 border-t border-zinc-900">
							<span class="flex items-center gap-1 text-indigo-400">
								<DollarSign class="h-4.5 w-4.5" />
								Total Amount
							</span>
							<span class="font-mono text-indigo-400">{formatCurrency(totalAmount)}</span>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>

		<!-- Submit Buttons -->
		<div class="flex justify-end gap-3 border-t border-zinc-900 pt-6">
			<a href="/dashboard">
				<Button variant="outline" disabled={loading}>
					Cancel
				</Button>
			</a>
			
			<Button
				type="submit"
				disabled={loading}
				class="flex items-center gap-1.5"
			>
				{#if loading}
					<div class="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
					Saving Invoice...
				{:else}
					<Save class="h-4 w-4" />
					Save Invoice
				{/if}
			</Button>
		</div>
	</form>
</div>
