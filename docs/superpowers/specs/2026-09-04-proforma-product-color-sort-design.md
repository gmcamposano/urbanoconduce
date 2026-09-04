# Proforma Product and Color Sort

## Goal

Let users of new and existing proforma forms reorder concept rows by product title and the canonical color order configured in `/dashboard/colors`.

## Interaction

- Add an outline `Producto + color` button beside the existing `Reciente` sort control.
- First click sorts ascending; later clicks toggle ascending and descending.
- Disable the button while submitting or when fewer than two populated rows exist.
- Keep empty template rows at the end.

## Ordering

Compare populated rows by:

1. Product title.
2. Color `sort_order` from `/dashboard/colors`.
3. Product model.
4. Original arrival sequence for stable ties.

Blank or unknown colors follow configured colors in ascending order. Descending reverses product, color, and model comparison while retaining stable arrival order for exact ties.

## Implementation

- Extend the shared `src/lib/proformaSort.ts` sort state and resolvers with product-color sorting.
- Resolve color rank from the already-loaded `product_colors.sort_order` data in both forms.
- Reorder the existing client-side items array, matching current proforma sorting behavior and submission flow.
- Make no database or server-action changes.

## Verification

- Unit-test ascending and descending product/color ordering, blank colors, and stable ties.
- Run Svelte autofix on both changed components.
- Run project checks and focused tests.
