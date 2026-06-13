-- =====================================================================
-- 0010_crypto_item.sql — detalhamento de uma corretora/ano
-- crypto_item = uma fatia do valor da corretora (TRADE, WINS, HOLD, LTC...).
-- Filha de crypto_summary (apaga junto).
-- =====================================================================
create table public.crypto_item (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant (id) on delete cascade,
  summary_id uuid not null references public.crypto_summary (id) on delete cascade,
  label      text not null,
  valor      numeric(14,2) not null default 0,
  ordem      int not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);
create index crypto_item_tenant_id_idx on public.crypto_item (tenant_id);
create index crypto_item_summary_id_idx on public.crypto_item (summary_id);

alter table public.crypto_item enable row level security;

create policy "crypto_item_select" on public.crypto_item for select to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "crypto_item_insert" on public.crypto_item for insert to authenticated
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "crypto_item_update" on public.crypto_item for update to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() )
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "crypto_item_delete" on public.crypto_item for delete to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );

grant select, insert, update, delete on table public.crypto_item to authenticated;
