# Accounting stock warning toast design

## Goal

After a payment is recorded, take the user to Accounting instead of leaving the payment form open when the related proforma has product variants without stock. Show the stock warning on that next screen as a temporary toast.

## Approved behavior

- Successful payment creation always redirects to `/dashboard/accounting`, whether or not stock warnings were found.
- When stock gaps exist, carry a one-use notification to the Accounting page using a short-lived flash cookie; do not put warning state in the URL or add a global notification store.
- The toast identifies the successful payment, explains that pending proforma products need inventory entries to complete stock output, and shows the existing counts: affected variant gaps and affected proformas.
- Include a `Ver inventario` link to `/dashboard/inventory`.
- Show a compact yellow toast near the top of the Accounting page, following `DESIGN.md`. Allow manual dismissal and auto-dismiss after 7 seconds.
- Consume and clear the flash on the Accounting page load so a refresh does not show it again. Do not create a toast when no stock gaps exist.
- Keep payment validation and persistence errors on the payment form. Do not change payment accounting, stock calculation, database schema, or inventory behavior.

## Flash data and safety

- Flash payload contains only the warning counts needed to render the notification; it is not a source of authorization or persistence decisions.
- Use a short cookie lifetime, restrict its path to the Accounting destination, and set appropriate `HttpOnly`, `SameSite`, and production `Secure` attributes.
- Validate the payload shape when reading it. Ignore malformed data and clear the cookie regardless, so stale or invalid notices cannot persist.

## Accessibility and lifecycle

- Expose the notification as a polite status message and give its dismiss button an accessible name.
- Keep the inventory link keyboard-accessible and visually identifiable.
- Clear the auto-dismiss timer when the toast is dismissed or the page component is destroyed.

## Implementation boundary

Update the payment action's successful warning path, the Accounting page's server load, and the Accounting page UI. Reuse the existing stock-warning counts and copy where possible. Do not add a reusable global toast framework or unrelated refactors.

## Design and validation

Follow `DESIGN.md` colors, hierarchy, compact spacing, and existing link/button patterns. Test successful payment with and without stock gaps, one-time flash consumption, malformed flash data, manual dismissal, 7-second auto-dismiss, and the inventory link. Run Svelte autofixer, targeted checks, formatting/lint, and production build as applicable.
