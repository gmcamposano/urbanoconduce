create or replace function public.update_accounting_payment(
	p_payment_id uuid,
	p_client_id uuid,
	p_amount numeric,
	p_payment_date date,
	p_payment_method text,
	p_reference_number text default null,
	p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
	v_role text;
	v_old_client_id uuid;
	v_old_amount numeric;
	v_old_invoice_ids uuid[];
	v_remaining numeric;
	v_available_balance numeric;
	v_first_invoice_id uuid;
	v_allocation_count integer := 0;
	v_invoice record;
	v_applied numeric;
	v_invoice_id uuid;
begin
	v_role := (select private.get_user_role());

	if v_role <> 'admin' then
		raise exception 'Solo un administrador puede editar pagos.';
	end if;

	if p_amount <= 0 then
		raise exception 'El monto debe ser mayor que cero.';
	end if;

	if p_payment_method not in ('cash', 'transfer', 'check', 'card', 'other') then
		raise exception 'Método de pago inválido.';
	end if;

	select client_id, amount
	into v_old_client_id, v_old_amount
	from public.accounting
	where id = p_payment_id;

	if not found then
		raise exception 'El pago no existe.';
	end if;

	select array_agg(distinct invoice_id)
	into v_old_invoice_ids
	from public.accounting_allocations
	where payment_id = p_payment_id;

	if v_old_invoice_ids is not null then
		perform 1
		from public.invoices i
		where i.id = any(v_old_invoice_ids)
		for update;
	end if;

	perform 1
	from public.invoices i
	where i.client_id = p_client_id
		and i.factura_tipo = 'proforma'
		and i.status in ('pending', 'overdue')
	for update;

	delete from public.accounting_allocations
	where payment_id = p_payment_id;

	select coalesce(sum(balance_due), 0)
	into v_available_balance
	from (
		select greatest(i.total_amount - coalesce(sum(a.applied_amount), 0), 0) as balance_due
		from public.invoices i
		left join public.accounting_allocations a on a.invoice_id = i.id
		where i.client_id = p_client_id
			and i.factura_tipo = 'proforma'
			and i.status in ('pending', 'overdue')
		group by i.id, i.total_amount
	) invoice_balances
	where balance_due > 0;

	-- If the client did not change, the deleted allocations free up the old amount.
	if v_old_client_id = p_client_id then
		v_available_balance := v_available_balance + v_old_amount;
	end if;

	if v_available_balance <= 0 then
		raise exception 'El cliente no tiene crédito disponible para aplicar.';
	end if;

	if p_amount > v_available_balance then
		raise exception 'El monto excede el crédito disponible del cliente.';
	end if;

	update public.accounting
	set client_id = p_client_id,
		amount = p_amount,
		payment_date = p_payment_date,
		payment_method = p_payment_method,
		reference_number = nullif(p_reference_number, ''),
		notes = nullif(p_notes, '')
	where id = p_payment_id;

	v_remaining := p_amount;

	for v_invoice in
		select
			i.id,
			i.invoice_date,
			i.due_date,
			i.created_at,
			greatest(i.total_amount - coalesce(sum(a.applied_amount), 0), 0) as balance_due
		from public.invoices i
		left join public.accounting_allocations a on a.invoice_id = i.id
		where i.client_id = p_client_id
			and i.factura_tipo = 'proforma'
			and i.status in ('pending', 'overdue')
		group by i.id, i.total_amount, i.invoice_date, i.due_date, i.created_at
		having greatest(i.total_amount - coalesce(sum(a.applied_amount), 0), 0) > 0
		order by i.invoice_date asc, i.due_date asc, i.created_at asc
	loop
		exit when v_remaining <= 0;

		v_applied := least(v_remaining, v_invoice.balance_due);

		if v_applied <= 0 then
			continue;
		end if;

		if v_first_invoice_id is null then
			v_first_invoice_id := v_invoice.id;
		end if;

		insert into public.accounting_allocations (payment_id, invoice_id, applied_amount)
		values (p_payment_id, v_invoice.id, v_applied);

		perform public.recalculate_invoice_status(v_invoice.id);

		v_remaining := v_remaining - v_applied;
		v_allocation_count := v_allocation_count + 1;
	end loop;

	update public.accounting
	set invoice_id = v_first_invoice_id
	where id = p_payment_id;

	if v_remaining <> 0 then
		raise exception 'No se pudo aplicar el monto completo del pago.';
	end if;

	-- Recalculate invoices that were previously affected when the client changes.
	if v_old_client_id is not null and v_old_client_id <> p_client_id and v_old_invoice_ids is not null then
		foreach v_invoice_id in array v_old_invoice_ids loop
			if v_invoice_id is not null then
				perform public.recalculate_invoice_status(v_invoice_id);
			end if;
		end loop;
	end if;

	return jsonb_build_object(
		'payment_id', p_payment_id,
		'allocation_count', v_allocation_count,
		'allocated_amount', p_amount
	);
end;
$$;

grant execute on function public.update_accounting_payment(uuid, uuid, numeric, date, text, text, text) to authenticated;
