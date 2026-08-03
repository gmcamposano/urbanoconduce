create or replace function private.deduct_stock_on_invoice_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	v_warehouse_id uuid;
	v_item record;
	v_movement_type text;
	v_stock numeric;
	v_has_insufficient_stock boolean := false;
begin
	-- Inventory belongs to proformas. Accounting payments must not deduct regular invoices.
	if coalesce(new.factura_tipo, '') <> 'proforma' then
		return new;
	end if;

	if tg_op = 'UPDATE' and old.status = 'paid' then
		return new;
	end if;
	if new.status <> 'paid' then
		return new;
	end if;

	perform 1 from public.inventory_movements where reference_type = 'invoice' and reference_id = new.id limit 1;
	if found then
		return new;
	end if;

	select id into v_warehouse_id from public.warehouses where is_default = true limit 1;
	if v_warehouse_id is null then
		raise warning 'No default warehouse found; cannot deduct stock for invoice %', new.id;
		return new;
	end if;

	v_movement_type := case when new.document_type = 'interna' then 'internal_transfer' else 'sale' end;

	for v_item in
		select product_variant_id, sum(quantity) as quantity
		from public.invoice_items
		where invoice_id = new.id
			and product_variant_id is not null
		group by product_variant_id
	loop
		select coalesce(sum(quantity), 0) into v_stock
		from public.inventory_movements
		where product_variant_id = v_item.product_variant_id;

		if v_stock < v_item.quantity then
			raise warning 'Stock insuficiente para la variante % (disponible %, requerido %)',
				v_item.product_variant_id, greatest(v_stock, 0), v_item.quantity;
			v_has_insufficient_stock := true;
		end if;
	end loop;

	if v_has_insufficient_stock then
		return new;
	end if;

	for v_item in
		select product_variant_id, sum(quantity) as quantity
		from public.invoice_items
		where invoice_id = new.id
			and product_variant_id is not null
		group by product_variant_id
	loop
		insert into public.inventory_movements (
			product_variant_id,
			warehouse_id,
			type,
			quantity,
			reference_type,
			reference_id,
			created_by
		) values (
			v_item.product_variant_id,
			v_warehouse_id,
			v_movement_type,
			-v_item.quantity,
			'invoice',
			new.id,
			coalesce(new.created_by, auth.uid())
		);
	end loop;

	return new;
end;
$$;

drop trigger if exists trg_invoices_deduct_stock on public.invoices;
create trigger trg_invoices_deduct_stock
	after insert or update on public.invoices
	for each row
	execute function private.deduct_stock_on_invoice_paid();
