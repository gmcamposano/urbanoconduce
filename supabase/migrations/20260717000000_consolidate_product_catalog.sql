-- Consolidate product catalog: products stop belonging to a single client.
-- Inventory is now keyed by product+model+color, not by client.
-- Per-client prices live in client_product_prices (already existed, was unused).
-- Existing invoices/proformas are snapshots: their invoice_items keep description,
-- unit_price, amount; we only repoint FKs to the surviving product/variant.

-- 1. Preserve every current per-client price into client_product_prices.
insert into public.client_product_prices (client_id, product_id, unit_price, created_by)
select p.client_id, p.id, p.price_without_taxes, p.created_by
from public.products p
on conflict (client_id, product_id) do nothing;

-- 2. Build a mapping of duplicate products to their survivor (oldest id per group).
create temp table product_merge as
with groups as (
	select (array_agg(id order by created_at asc, id asc))[1] as survivor_id
	from public.products
	group by lower(trim(title)), model
	having count(*) > 1
)
select p.id as old_id, g.survivor_id, p.client_id, p.price_without_taxes
from public.products p
join groups g on p.id <> g.survivor_id
where exists (
	select 1 from public.products p2
	where lower(trim(p2.title)) = lower(trim(p.title))
		and p2.model is not distinct from p.model
		and p2.id = g.survivor_id
);

-- 3. Move per-client prices from non-survivors onto the survivor.
insert into public.client_product_prices (client_id, product_id, unit_price, created_by)
select pm.client_id, pm.survivor_id, pm.price_without_taxes,
	(select created_by from public.products where id = pm.survivor_id)
from product_merge pm
on conflict (client_id, product_id) do nothing;

-- 4. Consolidate variants: for each non-survivor variant, either repoint to the
--    survivor's matching-color variant, or (if none) move the variant onto the survivor.
-- First, repoint invoice_items + inventory_movements to the survivor's existing variant.
update public.invoice_items ii
set product_variant_id = sv.id
from product_merge pm
join public.product_variants v on v.product_id = pm.old_id
join public.product_variants sv on sv.product_id = pm.survivor_id
	and sv.color = v.color
where ii.product_variant_id = v.id;

update public.inventory_movements im
set product_variant_id = sv.id
from product_merge pm
join public.product_variants v on v.product_id = pm.old_id
join public.product_variants sv on sv.product_id = pm.survivor_id
	and sv.color = v.color
where im.product_variant_id = v.id;

-- Delete the now-orphaned duplicate variants (no remaining references).
delete from public.product_variants v
using product_merge pm
where v.product_id = pm.old_id
	and exists (
		select 1 from public.product_variants sv
		where sv.product_id = pm.survivor_id and sv.color = v.color
	);

-- Move the remaining (unique-color) variants onto the survivor.
update public.product_variants v
set product_id = pm.survivor_id
from product_merge pm
where v.product_id = pm.old_id;

-- 5. Repoint invoice_items.product_id and inventory_movements reference_id (invoice)
--    to the survivor. invoice_items keep their snapshot fields untouched.
update public.invoice_items ii
set product_id = pm.survivor_id
from product_merge pm
where ii.product_id = pm.old_id;

-- 6. Delete the non-survivor products. Variants already moved/deleted above,
--    invoice_items repointed, client_product_prices copied (and FK is cascade anyway).
delete from public.products p
using product_merge pm
where p.id = pm.old_id;

-- 7. Drop the per-client uniqueness and make products a single global catalog.
alter table public.products alter column client_id drop not null;

alter table public.products drop constraint products_title_unique_per_client;

-- Unique on normalized title + model. Use a unique index on the expression.
create unique index if not exists products_title_model_unique_idx
	on public.products (lower(trim(title)), model);

-- 8. Keep client_product_prices unique per (client, product) — already enforced.
-- Nothing else to do.
