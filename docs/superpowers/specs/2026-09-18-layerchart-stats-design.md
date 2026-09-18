# LayerChart Stats Migration

## Goal

Replace the statistics page's hand-built LayerCake horizontal chart with a LayerChart vertical bar chart that makes product quantities easy to compare.

## Scope

- Replace `layercake` with `layerchart` in project dependencies.
- Replace `SalesByDescriptionChart.svelte` and remove `QuantityBars.svelte`.
- Show up to eight descriptions, sorted by the page's existing aggregate data order.
- Keep the full aggregate table unchanged.

## Chart

- Use LayerChart's `BarChart` with its default vertical orientation.
- X-axis: item description.
- Y-axis: quantity, with a zero baseline.
- Keep the existing emerald bar color and white dashboard surface.
- Chart height remains 240px so the statistics cards keep a compact layout.
- Expose a native accessible label per bar containing description, quantity, and amount.

## Empty And Dense Data

- Keep the current empty state when no positive quantities exist.
- Limit the chart to eight bars. The adjacent table remains the authoritative complete list.
- Long labels are shortened only in the chart; full descriptions remain available in the table and accessible chart label.

## Validation

- `npm run check` passes with no errors or warnings.
- Dashboard stats URL renders an accessible chart, quantity labels, and table data.
