-- =====================================================================
-- 0014_acao.sql — Módulo Ações (mesma ideia do 0008_fii.sql)
-- acao = uma posição: ticker + quantidade + preço médio (R$).
-- O preço ATUAL vem ao vivo (Yahoo Finance, sufixo .SA) no app.
-- =====================================================================

create table public.acao (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant (id) on delete cascade,
  ticker      text not null,
  quantidade  numeric(14,4) not null default 0,
  preco_medio numeric(14,2) not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);
create index acao_tenant_id_idx on public.acao (tenant_id);

alter table public.acao enable row level security;

create policy "acao_select" on public.acao for select to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "acao_insert" on public.acao for insert to authenticated
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "acao_update" on public.acao for update to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() )
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "acao_delete" on public.acao for delete to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );

grant select, insert, update, delete on table public.acao to authenticated;
