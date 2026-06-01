create table if not exists public.accounting_allocations (
	id uuid primary key default gen_random_uuid(),
	payment_id uuid not null references public.accounting(id) on delete cascade,
	invoice_id uuid not null references public.invoices(id) on delete cascade,
	applied_amount numeric not null check (applied_amount > 0),
	created_at timestamptz not null default timezone('utc'::text, now()),
	constraint accounting_allocations_payment_invoice_unique unique (payment_id, invoice_id)
);

alter table public.accounting_allocations enable row level security;

create index if not exists accounting_allocations_payment_id_idx on public.accounting_allocations using btree (payment_id);
create index if not exists accounting_allocations_invoice_id_idx on public.accounting_allocations using btree (invoice_id);
create index if not exists accounting_allocations_created_at_idx on public.accounting_allocations using btree (created_at desc);

drop policy if exists "Authenticated users can read accounting allocations" on public.accounting_allocations;
drop policy if exists "Admins and editors can insert accounting allocations" on public.accounting_allocations;
drop policy if exists "Admins and editors can update accounting allocations" on public.accounting_allocations;
drop policy if exists "Admins can delete accounting allocations" on public.accounting_allocations;

create policy "Authenticated users can read accounting allocations"
on public.accounting_allocations
for select
to authenticated
using (true);

create policy "Admins and editors can insert accounting allocations"
on public.accounting_allocations
for insert
to authenticated
with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins and editors can update accounting allocations"
on public.accounting_allocations
for update
to authenticated
using ((select private.get_user_role()) in ('admin', 'editor'))
with check ((select private.get_user_role()) in ('admin', 'editor'));

create policy "Admins can delete accounting allocations"
on public.accounting_allocations
for delete
to authenticated
using ((select private.get_user_role()) = 'admin');

insert into public.accounting_allocations (payment_id, invoice_id, applied_amount)
select a.id, a.invoice_id, a.amount
from public.accounting a
where a.invoice_id is not null
on conflict (payment_id, invoice_id) do nothing;

create or replace function public.recalculate_invoice_status(p_invoice_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
	v_total_amount numeric;
	v_due_date date;
	v_paid_amount numeric;
begin
	select i.total_amount, i.due_date
	into v_total_amount, v_due_date
	from public.invoices i
	where i.id = p_invoice_id;

	if not found then
		return;
	end if;

	select coalesce(sum(a.applied_amount), 0)
	into v_paid_amount
	from public.accounting_allocations a
	where a.invoice_id = p_invoice_id;

	update public.invoices
	set status = case
		when v_paid_amount >= v_total_amount then 'paid'
		when v_due_date < current_date then 'overdue'
		else 'pending'
	end
	where id = p_invoice_id;
end;
$$;

create or replace function public.record_accounting_payment(
	p_client_id uuid,
	p_amount numeric,
	p_payment_date date,
	p_payment_method text,
	p_reference_number text default null,
	p_notes text default null,
	p_created_by uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
	v_role text;
	v_payment_id uuid;
	v_first_invoice_id uuid;
	v_remaining numeric;
	v_available_balance numeric;
	v_allocation_count integer := 0;
	v_invoice record;
	v_applied numeric;
begin
	v_role := (select private.get_user_role());

	if v_role not in ('admin', 'editor') then
		raise exception 'Solo admins y editores pueden registrar pagos.';
	end if;

	if p_amount <= 0 then
		raise exception 'El monto debe ser mayor que cero.';
	end if;

	if p_payment_method not in ('cash', 'transfer', 'check', 'card', 'other') then
		raise exception 'Método de pago inválido.';
	end if;

	perform 1
	from public.invoices i
	where i.client_id = p_client_id
		and i.factura_tipo = 'proforma'
		and i.status in ('pending', 'overdue')
	for update;

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

	if v_available_balance <= 0 then
		raise exception 'El cliente no tiene crédito disponible para aplicar.';
	end if;

	if p_amount > v_available_balance then
		raise exception 'El monto excede el crédito disponible del cliente.';
	end if;

	insert into public.accounting (
		client_id,
		invoice_id,
		amount,
		payment_date,
		payment_method,
		reference_number,
		notes,
		created_by
	)
	values (
		p_client_id,
		null,
		p_amount,
		p_payment_date,
		p_payment_method,
		nullif(p_reference_number, ''),
		nullif(p_notes, ''),
		p_created_by
	)
	returning id into v_payment_id;

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
		values (v_payment_id, v_invoice.id, v_applied);

		perform public.recalculate_invoice_status(v_invoice.id);

		v_remaining := v_remaining - v_applied;
		v_allocation_count := v_allocation_count + 1;
	end loop;

	if v_first_invoice_id is not null then
		update public.accounting
		set invoice_id = v_first_invoice_id
		where id = v_payment_id;
	end if;

	if v_remaining <> 0 then
		raise exception 'No se pudo aplicar el monto completo del pago.';
	end if;

	return jsonb_build_object(
		'payment_id', v_payment_id,
		'allocation_count', v_allocation_count,
		'allocated_amount', p_amount
	);
end;
$$;

create or replace function public.delete_accounting_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
	v_role text;
	v_invoice_ids uuid[];
	v_invoice_id uuid;
	v_deleted_payment_id uuid;
begin
	v_role := (select private.get_user_role());

	if v_role <> 'admin' then
		raise exception 'Solo un administrador puede eliminar pagos.';
	end if;

	select array_agg(distinct a.invoice_id)
	into v_invoice_ids
	from public.accounting_allocations a
	where a.payment_id = p_payment_id;

	if v_invoice_ids is not null then
		perform 1
		from public.invoices i
		where i.id = any(v_invoice_ids)
		for update;
	end if;

	delete from public.accounting
	where id = p_payment_id
	returning id into v_deleted_payment_id;

	if not found then
		raise exception 'El pago no existe.';
	end if;

	if v_invoice_ids is not null then
		foreach v_invoice_id in array v_invoice_ids loop
			perform public.recalculate_invoice_status(v_invoice_id);
		end loop;
	end if;

	return jsonb_build_object(
		'success', true,
		'payment_id', v_deleted_payment_id,
		'affected_invoices', coalesce(array_length(v_invoice_ids, 1), 0)
	);
end;
$$;

grant execute on function public.recalculate_invoice_status(uuid) to authenticated;
grant execute on function public.record_accounting_payment(uuid, numeric, date, text, text, text, uuid) to authenticated;
grant execute on function public.delete_accounting_payment(uuid) to authenticated;
