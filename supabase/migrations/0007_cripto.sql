-- =====================================================================
-- 0007_cripto.sql — Módulo Cripto (resumo por corretora)
-- crypto_summary = uma linha por (corretora, ano): aplicado + lucro/prejuízo.
-- Valores em US$ (convertidos pra real no app pela cotação ao vivo).
-- Um registro por (corretora, ano) -> unique, e upsert na edição/import.
-- =====================================================================

create table public.crypto_summary (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant (id) on delete cascade,
  exchange   text not null,
  ano        int  not null,
  aplicado   numeric(14,2) not null default 0,
  resultado  numeric(14,2) not null default 0, -- lucro (+) ou prejuízo (-)
  created_at timestamptz not null default now(),
  unique (tenant_id, exchange, ano)
);
create index crypto_summary_tenant_id_idx on public.crypto_summary (tenant_id);

alter table public.crypto_summary enable row level security;

create policy "crypto_summary_select" on public.crypto_summary for select to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "crypto_summary_insert" on public.crypto_summary for insert to authenticated
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "crypto_summary_update" on public.crypto_summary for update to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() )
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "crypto_summary_delete" on public.crypto_summary for delete to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );

grant select, insert, update, delete on table public.crypto_summary to authenticated;
