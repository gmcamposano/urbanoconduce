# Accounting stock warning toast implementation plan

## Scope

Implement the approved design in the payment action, Accounting server load, and Accounting page UI. No schema migration or reusable/global toast framework.

## Tasks

1. Add a server-only helper to set and consume a short-lived Accounting stock-warning flash cookie. Restrict its path to `/dashboard/accounting`, use `HttpOnly`, `SameSite=Lax`, and `Secure` outside development, validate positive integer counts, and clear the cookie even when its contents are invalid.
2. Update `createPayment` to set the flash only when stock-warning gaps exist, then redirect to `/dashboard/accounting` on every successful payment. Leave validation and persistence failures unchanged.
3. Consume the flash in `src/routes/dashboard/accounting/+page.server.ts` and return its validated counts in page data; preserve the value in its existing fallback response if other accounting queries fail.
4. Render a compact yellow, accessible toast at the top of `src/routes/dashboard/accounting/+page.svelte`, with the existing warning explanation and counts, `Ver inventario` link, an accessible close button, and a 7-second auto-dismiss whose timer is cleaned up on dismissal/unmount.
5. Validate with Svelte autofixer, `npm run check`, `npm run lint`, and `npm run build`. Exercise no-warning, warning, one-time consumption, invalid-cookie, link, manual dismissal, and timer behavior in dev before production deployment.

## Production gate

No Supabase migration is expected. Do not deploy the feature until dev behavior is verified; production push follows user confirmation after that verification.
