-- =====================================================================
-- 0008_fii.sql — Módulo FIIs (cotas que você tem)
-- fii = uma posição: ticker + quantidade de cotas + preço médio (R$).
-- O preço ATUAL vem ao vivo (brapi.dev) no app; valor/lucro são calculados.
-- =====================================================================

create table public.fii (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant (id) on delete cascade,
  ticker      text not null,
  quantidade  numeric(14,4) not null default 0,
  preco_medio numeric(14,2) not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);
create index fii_tenant_id_idx on public.fii (tenant_id);

alter table public.fii enable row level security;

create policy "fii_select" on public.fii for select to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "fii_insert" on public.fii for insert to authenticated
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "fii_update" on public.fii for update to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() )
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "fii_delete" on public.fii for delete to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );

grant select, insert, update, delete on table public.fii to authenticated;
