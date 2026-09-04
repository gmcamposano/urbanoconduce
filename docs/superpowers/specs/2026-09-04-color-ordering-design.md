# Color Ordering Design

## Goal

Let catalog managers define one persistent color order in `/dashboard/colors`. Use that order everywhere colors are presented while creating or editing a proforma.

## Scope

- Add persistent ordering to `product_colors`.
- Add drag-and-drop sorting and up/down fallback controls to `/dashboard/colors`.
- Apply the saved order to color choices in `/dashboard/proforma/new` and `/dashboard/proforma/[id]/edit`, including quick-add lists fed by those routes.
- Keep color creation, editing, deletion, and proforma behavior otherwise unchanged.

## Data Model

Add a non-null integer `sort_order` column to `public.product_colors`. Backfill existing colors in their current dashboard order (`created_at DESC`) so deployment does not unexpectedly rearrange the list.

Saved positions are unique. A reorder normalizes them to a contiguous sequence; deletion may leave harmless gaps. New colors append after the current last position. Reads use `sort_order ASC`.

Expose one authenticated reorder database function accepting the complete ordered array of color IDs. It validates that IDs are unique and exactly match the current color set, then updates all positions in one transaction. The function runs with caller permissions so existing row-level update authorization remains authoritative. Revoke default public execution and grant execution only to `authenticated`.

## Dashboard Interaction

Each color row has:

- A visible drag handle for pointer, touch, and keyboard reordering.
- Up and down buttons as explicit accessible fallbacks.
- Existing edit and delete controls.

Use `svelte-dnd-action` with a handle zone because it supports pointer, touch, and keyboard input. Keep rows keyed by color ID and animate movement with Svelte `flip`. Up/down buttons are disabled at list boundaries and have Spanish `aria-label` text.

Dragging updates a local list during consideration. Dropping submits the complete ID order once. Arrow clicks swap adjacent local items and submit the same complete payload. Disable ordering controls while a save is in flight to prevent overlapping requests.

An `aria-live` status reports saved order or failure. On failure, display the existing error treatment and restore canonical order by invalidating page data. Successful saves retain focus where practical and do not reset the color creation form.

Controls follow `DESIGN.md`: white/neutral surfaces, hairline borders, 6px radii, near-black text, and at least 36px touch targets. Emerald remains reserved for the main create/update CTA.

## Server Flow

Add a named `reorderColors` form action to the colors route.

1. Require an authenticated admin or editor, matching current catalog management access.
2. Parse a JSON array of UUID strings.
3. Reject malformed, duplicate, missing, or extra IDs.
4. Call the atomic reorder database function.
5. Return a Spanish success or validation error response.

Color creation calculates the next position and appends the new color. Dashboard, proforma-new, and proforma-edit loaders request `sort_order` and order ascending. Existing select and quick-add components preserve input order, so they require no sorting logic.

## Failure And Concurrency

Reordering is all-or-nothing. A rejected or failed update cannot leave a partially reordered list. If colors change between page load and reorder submission, complete-set validation rejects stale input; the page reloads current data and asks the user to try again. Concurrent valid reorders use last completed write as the visible order.

## Verification

- Migration backfills every existing color with a unique contiguous position.
- Admin and editor can reorder; other authenticated users cannot update order.
- Drag works with pointer and touch; handle supports keyboard interaction.
- Arrow controls work by keyboard and disable correctly at first/last rows.
- Failed reorder restores server order and reports an error.
- New colors appear at the bottom.
- New and edit proforma color dropdowns follow saved order.
- Quick-add color lists follow saved order.
- `svelte-check`, ESLint, Prettier, and production build pass.
- Desktop and mobile browser flows pass.

## Out Of Scope

- Per-user or per-product color orders.
- Reordering models or products.
- Changing color values stored on existing variants or invoice items.
- Applying custom order to unrelated screens unless they already consume the same ordered route data.
