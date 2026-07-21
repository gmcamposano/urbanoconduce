-- Follow-up: drop NOT NULL on price_list_entries.unit_price so that
-- entries can use discount_percentage mode exclusively.
-- The check constraint (unit_price IS NOT NULL OR discount_percentage IS NOT NULL)
-- already guarantees at least one mode is set.

alter table public.price_list_entries alter column unit_price drop not null;
