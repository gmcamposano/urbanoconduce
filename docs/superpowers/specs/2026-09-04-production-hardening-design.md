# Proforma and Dialog Production Hardening

## Scope

Harden the deployed color-ordering and dialog scroll-lock changes without changing UI design or business behavior.

## Scroll Lock

Create one browser-only lock utility with reference counting. The first lock stores the body's inline overflow and padding, adds scrollbar compensation to existing computed padding, and disables scrolling. Each caller receives an idempotent release function. Only the final release restores the original styles.

`Dialog` and the dashboard mobile menu use this utility. Existing dialog callers stop writing body styles directly, making nested and overlapping overlays safe.

## Data Loading

Product colors are required reference data for proforma creation and editing. Their loaders must throw a server error when the query fails instead of converting the failure into an empty list.

## Color Ordering

Add a follow-up migration that serializes automatic `sort_order` allocation with a transaction-scoped advisory lock. Reordering already locks the table and remains unchanged.

Repair migration history so the repository version `20260904094746` is recorded consistently rather than the generated MCP versions.

## Verification

- Validate every edited Svelte file with the Svelte autofixer.
- Run `npm run check` and separate new failures from existing failures.
- Query dev to verify sequential color insertion and ordered reads.
- Run Supabase security and performance advisors after the dev migration.
- Apply and verify production only after user confirms dev behavior.
