-- =====================================================================
-- 0011_renda_fixa.sql — Módulo Renda Fixa
-- fixed_income = um título: Tesouro, CDB, LCI/LCA... com aplicado e atual.
-- Valor atual é manual (sem cotação ao vivo confiável por título).
-- =====================================================================
create table public.fixed_income (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenant (id) on delete cascade,
  nome           text not null,
  instituicao    text,
  tipo           text,
  valor_aplicado numeric(14,2) not null default 0,
  valor_atual    numeric(14,2) not null default 0,
  vencimento     date,
  ativo          boolean not null default true,
  created_at     timestamptz not null default now()
);
create index fixed_income_tenant_id_idx on public.fixed_income (tenant_id);

alter table public.fixed_income enable row level security;

create policy "fixed_income_select" on public.fixed_income for select to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "fixed_income_insert" on public.fixed_income for insert to authenticated
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "fixed_income_update" on public.fixed_income for update to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() )
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "fixed_income_delete" on public.fixed_income for delete to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );

grant select, insert, update, delete on table public.fixed_income to authenticated;
