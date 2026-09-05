# Proforma CSV Quantity Replacement

## Goal

Allow a CSV exported from a proforma to update quantities when uploaded again. Existing rows are matched by product and color; new rows are added.

## User Experience

- Parse and validate the complete CSV before changing the concepts table.
- When at least one matching product and color has a different quantity, show a confirmation dialog before applying any valid CSV row.
- State how many existing quantities will change and how many new rows will be added.
- Use `Cancelar` and `Actualizar cantidades e importar` actions.
- Cancelling leaves every current row unchanged.
- When no matching quantity changes, add valid new rows without showing the confirmation dialog.
- Keep the existing import result dialog for imported rows and validation errors.

## Import Rules

- Match an existing row using the same product and color identity used by the current duplicate detection.
- For a match with a different quantity, replace only `cantidad` with the CSV value.
- For a match with the same quantity, make no change and do not count it as an update.
- Add valid CSV rows whose product and color are not already present.
- Preserve existing unit prices and all other row values when replacing a quantity.
- Apply confirmed changes and additions together as one client-side operation.
- Invalid CSV rows never modify the concepts table and remain visible in the import report.

## Implementation

- Extend the pure CSV import result in `src/lib/proformaCsv.ts` so it separates quantity replacements from new rows instead of omitting every existing product and color pair.
- Update `src/lib/components/ProformaCsvImport.svelte` to hold a parsed import as pending state when confirmation is required.
- Reuse `src/lib/components/ui/Dialog.svelte` and established warning/button styles from the proforma forms.
- Extend the existing import callback contract so both new rows and quantity replacements are applied by each form's current state owner.
- Use the shared component for both `/dashboard/proforma/new` and `/dashboard/proforma/[id]/edit`; keep behavior identical between routes.
- Keep processing client-side. No server, database, or migration changes.

## Accessibility And Design

- Follow `DESIGN.md`: white canvas, hairline border, 16 px dialog radius, level-3 shadow, outline cancel action, emerald confirmation action.
- Give the dialog a clear warning title and plain-language consequence text.
- Preserve shared dialog keyboard behavior, focus handling, Escape dismissal, overlay dismissal, and body scroll lock.

## Verification

- Add focused unit coverage for changed quantities, unchanged quantities, new rows, mixed files, duplicate CSV rows, invalid rows, and product/color matching.
- Verify cancellation applies nothing and confirmation applies quantity replacements plus additions together.
- Verify uploads without quantity changes retain the current no-confirmation path.
- Run Svelte autofixer on every changed Svelte component.
- Run focused tests, `npm run check`, and `npm run lint`.
