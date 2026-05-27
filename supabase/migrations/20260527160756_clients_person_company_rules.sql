-- ==========================================
-- Clients person/company validation rules
-- ==========================================

alter table public.clients
	alter column full_name drop not null;

alter table public.clients
	drop constraint if exists clients_company_fields_required;

alter table public.clients
	add constraint clients_required_fields check (
		(
			client_type = 'person'
			and btrim(coalesce(full_name, '')) <> ''
		)
		or (
			client_type = 'company'
			and btrim(coalesce(alias, '')) <> ''
			and btrim(coalesce(rnc, '')) <> ''
			and btrim(coalesce(company_name, '')) <> ''
		)
	);
