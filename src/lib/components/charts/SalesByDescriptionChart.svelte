<script lang="ts">
	import { Bar, BarChart } from 'layerchart';

	type Row = { description: string; quantity: number; amount: number };

	let {
		data,
		height = 240
	}: {
		data: Row[];
		height?: number;
	} = $props();

	const chartData = $derived(data.filter((d) => d.quantity > 0).slice(0, 8));

	function truncate(text: string, max = 16) {
		return text.length > max ? `${text.slice(0, max - 1)}…` : text;
	}

	function formatNumber(value: number) {
		return new Intl.NumberFormat('es-DO').format(value);
	}

	function formatCurrency(value: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
	}

	function barLabel(row: Row) {
		return `${row.description}: ${formatNumber(row.quantity)} unidades (${formatCurrency(row.amount)})`;
	}

	const chartProps = {
		xAxis: {
			label: 'Descripción',
			format: (value: string) => truncate(value),
			tickLabelProps: { fontSize: 10, fill: '#707070' }
		},
		yAxis: {
			label: 'Cantidad',
			format: (value: number) => formatNumber(value),
			tickLabelProps: { fontSize: 10, fill: '#707070' }
		}
	};
</script>

{#if chartData.length === 0}
	<div
		style="height: {height}px"
		class="flex items-center justify-center rounded-md border border-dashed border-[#dfdfdf] text-xs text-[#707070]"
	>
		Sin datos para mostrar
	</div>
{:else}
	<div style="height: {height}px" class="w-full">
		<BarChart
			data={chartData}
			x="description"
			y="quantity"
			yDomain={[0, null]}
			cRange={['#24b47e']}
			padding={{ top: 12, right: 12, bottom: 42, left: 46 }}
			aria-label="Cantidad vendida por descripción"
			role="img"
			props={chartProps}
		>
			{#snippet marks()}
				{#each chartData as row (row.description)}
					<Bar
						data={row}
						x="description"
						y="quantity"
						fill="#24b47e"
						role="img"
						aria-label={barLabel(row)}
					/>
				{/each}
			{/snippet}
		</BarChart>
	</div>
{/if}
