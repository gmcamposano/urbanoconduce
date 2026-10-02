# Proforma percentage discount design

## Goal

Allow users to enter either a fixed-amount discount or percentage discount when creating or editing a proforma.

## Approved behavior

- Add a `Monto` / `%` selector to the discount section in `/dashboard/proforma/new` and `/dashboard/proforma/[id]/edit`.
- Show one active discount input at a time.
- Percentage applies to the pre-tax subtotal, including the existing net-subtotal calculation when prices include tax.
- Limit percentage input to 0–100%.
- Show the calculated monetary discount in the pricing breakdown; existing taxable base and total calculations use that amount.
- Submit the calculated value through existing `discount_amount` field. Persist only the monetary amount; no schema migration.
- Existing proformas open in `Monto` mode with their saved amount. Percentage selection is not retained after save.

## Implementation boundary

Update only the proforma create and edit forms plus their client-side calculation state. Keep server persistence and database structure based on `discount_amount`. Do not extend invoice forms or change discount behavior outside these proforma flows.

## Design and validation

Follow `DESIGN.md` and existing form controls/spacing. Validate Svelte checks, targeted lint, formatting, and production build. Confirm both forms preview the same percentage-derived amount that their actions persist.
