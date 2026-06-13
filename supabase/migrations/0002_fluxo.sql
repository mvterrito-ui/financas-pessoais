-- =====================================================================
-- 0002_fluxo.sql — Módulo Fluxo de Caixa
-- account     = onde o dinheiro entra/sai (Cartão XP, Pix, MEI, Bybit...)
-- category    = pra quê serve (Salário, Mercado, Faculdade...)
-- transaction = o lançamento em si (a tabela-coração)
-- =====================================================================

-- 1) account -----------------------------------------------------------
create table public.account (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant (id) on delete cascade,
  name       text not null,
  tipo       text not null default 'conta' check (tipo in ('conta','cartao','dinheiro','investimento')),
  moeda      text not null default 'BRL'  check (moeda in ('BRL','USD','EUR','BTC')),
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);
create index account_tenant_id_idx on public.account (tenant_id);

-- 2) category ----------------------------------------------------------
create table public.category (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant (id) on delete cascade,
  name       text not null,
  tipo       text not null check (tipo in ('entrada','saida')),
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);
create index category_tenant_id_idx on public.category (tenant_id);

-- 3) transaction -------------------------------------------------------
create table public.transaction (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant (id) on delete cascade,
  tipo        text not null check (tipo in ('entrada','saida')),
  valor       numeric(14,2) not null check (valor > 0),  -- sempre positivo; o tipo dá a direção
  data        date not null,
  descricao   text,
  recorrente  boolean not null default false,            -- gasto fixo (true) vs avulso (false)
  category_id uuid references public.category (id) on delete set null,
  account_id  uuid references public.account  (id) on delete set null,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);
create index transaction_tenant_id_idx on public.transaction (tenant_id);
create index transaction_data_idx      on public.transaction (data);

-- 4) RLS: liga a trava nas três tabelas --------------------------------
alter table public.account     enable row level security;
alter table public.category    enable row level security;
alter table public.transaction enable row level security;

-- 5) Policies (4 por tabela). A regra é sempre a mesma:
--    "só mexe nas linhas do seu tenant". insert/update usam WITH CHECK.
--    Macro repetida pra cada tabela (account, category, transaction).

-- account
create policy "account_select" on public.account for select to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "account_insert" on public.account for insert to authenticated
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "account_update" on public.account for update to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() )
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "account_delete" on public.account for delete to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );

-- category
create policy "category_select" on public.category for select to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "category_insert" on public.category for insert to authenticated
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "category_update" on public.category for update to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() )
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "category_delete" on public.category for delete to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );

-- transaction
create policy "transaction_select" on public.transaction for select to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "transaction_insert" on public.transaction for insert to authenticated
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "transaction_update" on public.transaction for update to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() )
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "transaction_delete" on public.transaction for delete to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );

-- 6) Grants pro papel autenticado --------------------------------------
grant select, insert, update, delete on table public.account     to authenticated;
grant select, insert, update, delete on table public.category    to authenticated;
grant select, insert, update, delete on table public.transaction to authenticated;
