# Proforma Current Rows CSV Export

## Goal

Add an import-compatible CSV download to new and edit proforma forms. Unlike the catalog-backed template, this export represents the current concepts table.

## User Experience

- Add an outline `Descargar CSV` button beside `Plantilla` and `Subir CSV`.
- Export only rows that have a selected product.
- Export in canonical `Producto + color` ascending order and preserve quantities. This is the exact order established by the table's `Producto + color` button: product title, model, product ID, then configured color `sort_order`; known colors come first, while unknown and blank colors remain stable at the end.
- Disable the button when there are no exportable rows.
- Name the file `proforma-<numero>.csv`, using the current proforma number shown in the form.

## CSV Contract

- Use the existing import headers: `producto,modelo,color,cantidad`.
- Resolve product and model labels from catalog data rather than exporting internal IDs.
- Keep blank colors blank.
- Include the UTF-8 BOM already used by the template for spreadsheet compatibility.
- Apply the existing CSV escaping rules to commas, semicolons, quotes, and newlines.
- Do not export unit price or row total because the import flow intentionally resolves current client or catalog pricing.

## Implementation

- Extend `src/lib/proformaCsv.ts` with pure current-row CSV serialization plus browser download functions. Reuse `sortProformaItems` with `{ key: 'producto_color', dir: 'asc' }` rather than duplicating its comparator.
- Extend `ProformaCsvImport.svelte` with current rows and filename props, then render the new button using existing button styles.
- Pass live row state and the current proforma number from both new and edit forms.
- Keep all processing client-side. No server, database, or migration changes.

## Error Handling

- Unknown product IDs are omitted instead of producing an invalid CSV row.
- Object URLs are revoked after download using the same lifecycle as the template download.

## Verification

- Add focused unit coverage for canonical `Producto + color` order, configured color rank, duplicate product labels/models, label resolution, blank fields, omitted empty/unknown product rows, escaping, and BOM/header output.
- Run Svelte autofixer on every changed Svelte component.
- Run `npm run check`, focused tests, and `npm run lint`.
