-- Revert price lists feature entirely.
-- Drops all price-list related tables and restores clients.default_price_list_id.
-- Safe because prod had 0 clients with default_price_list_id set before the
-- feature was introduced (price_lists table was empty).

drop table if exists public.client_price_list_assignments cascade;
drop table if exists public.price_list_entries cascade;
drop table if exists public.price_lists cascade;

alter table public.clients
	add column default_price_list_id uuid;
