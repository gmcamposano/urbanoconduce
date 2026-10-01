# Proforma model-grouped tables design

## Goal

Make products on `/dashboard/proforma/[id]` easier to scan by grouping invoice lines under their product model.

## Approved presentation

- Render a separate table for every model represented by the proforma's invoice items.
- Use the model name as the table section heading.
- Put invoice items without a model into a separate table headed exactly `Miscelaneo`.
- Each table repeats its own column headings.
- Retain product description, color, quantity, unit price, line total, and tax-inclusive total. Omit the model column because the section heading provides that information.
- Show each table's quantity subtotal; retain existing invoice-level financial totals and payment details unchanged.

## Data and behavior

Group existing invoice items by their `model` ID, resolving model names from the already-loaded `product_models` data. Do not change the invoice item records or database schema. Preserve item ordering within each model group using the existing display sort. Items whose model ID is null or cannot be resolved go into `Miscelaneo`.

## Design and responsive behavior

Follow `DESIGN.md`: white canvas, near-black text, muted gray secondary text, fine gray borders, and existing table typography. Keep tables full-width and horizontally legible at print and screen sizes. Maintain print-friendly row break behavior.

## Validation

- Check Svelte diagnostics, lint, and build.
- Verify one table per model, the `Miscelaneo` fallback, per-table quantities, and preservation of invoice totals.
- Confirm styling follows `DESIGN.md`.
