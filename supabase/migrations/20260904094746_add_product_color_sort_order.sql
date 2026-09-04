alter table public.product_colors
add column sort_order integer default 0;

with ordered_colors as (
	select
		id,
		row_number() over (order by created_at desc, id) as position
	from public.product_colors
)
update public.product_colors as colors
set sort_order = ordered_colors.position
from ordered_colors
where colors.id = ordered_colors.id;

alter table public.product_colors
	alter column sort_order set not null,
	add constraint product_colors_sort_order_positive check (sort_order > 0),
	add constraint product_colors_sort_order_key unique (sort_order) deferrable initially deferred;

create or replace function private.set_product_color_sort_order()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
	if new.sort_order <= 0 then
		select coalesce(max(colors.sort_order), 0) + 1
		into new.sort_order
		from public.product_colors as colors;
	end if;

	return new;
end;
$$;

drop trigger if exists product_colors_set_sort_order on public.product_colors;
create trigger product_colors_set_sort_order
before insert on public.product_colors
for each row
execute function private.set_product_color_sort_order();

create or replace function public.reorder_product_colors(p_color_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
	provided_count integer;
	unique_count integer;
	existing_count integer;
begin
	lock table public.product_colors in share row exclusive mode;

	provided_count := coalesce(cardinality(p_color_ids), 0);

	select count(distinct color_id)
	into unique_count
	from unnest(coalesce(p_color_ids, array[]::uuid[])) as submitted(color_id);

	select count(*)
	into existing_count
	from public.product_colors;

	if provided_count <> unique_count
		or provided_count <> existing_count
		or exists (
			select 1
			from public.product_colors as colors
			where not (colors.id = any(coalesce(p_color_ids, array[]::uuid[])))
		)
	then
		raise exception using
			errcode = '22023',
			message = 'Color order must contain every color exactly once.';
	end if;

	update public.product_colors as colors
	set sort_order = submitted.position
	from unnest(p_color_ids) with ordinality as submitted(color_id, position)
	where colors.id = submitted.color_id;
end;
$$;

revoke all on function public.reorder_product_colors(uuid[]) from public;
grant execute on function public.reorder_product_colors(uuid[]) to authenticated;
