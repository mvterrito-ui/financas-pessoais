-- =====================================================================
-- 0020_consorcio_reajuste.sql
-- 1) Reajustes da parcela do consórcio: "a partir da parcela nº X, o valor
--    passa a ser Y". O app soma cada parcela pelo valor da época.
-- 2) Patrimônio: novo lugar automático 'consorcio' (valor já pago).
-- Seguro pra rodar mais de uma vez.
-- =====================================================================
create table if not exists public.consorcio_reajuste (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenant (id) on delete cascade,
  consorcio_id     uuid not null references public.consorcio (id) on delete cascade,
  a_partir_parcela int not null check (a_partir_parcela between 1 and 400),
  valor_parcela    numeric(14,2) not null check (valor_parcela >= 0),
  created_at       timestamptz not null default now(),
  unique (consorcio_id, a_partir_parcela)
);
create index if not exists consorcio_reajuste_tenant_id_idx on public.consorcio_reajuste (tenant_id);

alter table public.consorcio_reajuste enable row level security;

drop policy if exists "consorcio_reajuste_select" on public.consorcio_reajuste;
create policy "consorcio_reajuste_select" on public.consorcio_reajuste for select to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );
drop policy if exists "consorcio_reajuste_insert" on public.consorcio_reajuste;
create policy "consorcio_reajuste_insert" on public.consorcio_reajuste for insert to authenticated
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
drop policy if exists "consorcio_reajuste_update" on public.consorcio_reajuste;
create policy "consorcio_reajuste_update" on public.consorcio_reajuste for update to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() )
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
drop policy if exists "consorcio_reajuste_delete" on public.consorcio_reajuste;
create policy "consorcio_reajuste_delete" on public.consorcio_reajuste for delete to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );

grant select, insert, update, delete on table public.consorcio_reajuste to authenticated;

-- Patrimônio: aceita a origem 'consorcio' nos lugares automáticos.
alter table public.wealth_place drop constraint if exists wealth_place_origem_check;
alter table public.wealth_place
  add constraint wealth_place_origem_check
  check (origem in ('acao', 'fii', 'renda_fixa', 'cripto', 'consorcio'));
