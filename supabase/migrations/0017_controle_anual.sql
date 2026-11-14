-- =====================================================================
-- 0017_controle_anual.sql — Controle Anual (grade de 12 meses)
-- Inspirado numa planilha de orçamento pessoal, mas SEM nada pré-cadastrado:
-- o usuário cria a própria estrutura.
--
-- annual_group    = grupo (Receitas, Despesas fixas...). O TIPO define a conta:
--                   saldo = receitas − investimentos − despesas.
-- annual_category = nível intermediário OPCIONAL (Moradia, Transporte...).
-- annual_item     = a linha da grade (Aluguel, Luz...).
-- annual_value    = valor de um item num mês. 1 por (item, mês) -> upsert.
--                   Sem linha = mês vazio (diferente de 0).
-- =====================================================================

create table public.annual_group (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant (id) on delete cascade,
  name       text not null,
  tipo       text not null check (tipo in ('receita', 'investimento', 'despesa')),
  descricao  text,
  ordem      int not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);
create index annual_group_tenant_id_idx on public.annual_group (tenant_id);

create table public.annual_category (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant (id) on delete cascade,
  group_id   uuid not null references public.annual_group (id) on delete cascade,
  name       text not null,
  ordem      int not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);
create index annual_category_tenant_id_idx on public.annual_category (tenant_id);

create table public.annual_item (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant (id) on delete cascade,
  group_id    uuid not null references public.annual_group (id) on delete cascade,
  category_id uuid references public.annual_category (id) on delete set null,
  name        text not null,
  ordem       int not null default 0,
  -- oculto: some dos anos em que não tem valor; onde tem, continua (histórico).
  oculto      boolean not null default false,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);
create index annual_item_tenant_id_idx on public.annual_item (tenant_id);

create table public.annual_value (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant (id) on delete cascade,
  item_id    uuid not null references public.annual_item (id) on delete cascade,
  mes        date not null check (extract(day from mes) = 1),
  valor      numeric(14,2) not null check (valor >= 0),
  created_at timestamptz not null default now(),
  unique (item_id, mes)
);
create index annual_value_tenant_id_idx on public.annual_value (tenant_id);
create index annual_value_mes_idx on public.annual_value (mes);

-- RLS: "só o seu tenant", 4 políticas por tabela (mesmo padrão do app).
alter table public.annual_group    enable row level security;
alter table public.annual_category enable row level security;
alter table public.annual_item     enable row level security;
alter table public.annual_value    enable row level security;

create policy "annual_group_select" on public.annual_group for select to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "annual_group_insert" on public.annual_group for insert to authenticated
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "annual_group_update" on public.annual_group for update to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() )
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "annual_group_delete" on public.annual_group for delete to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );

create policy "annual_category_select" on public.annual_category for select to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "annual_category_insert" on public.annual_category for insert to authenticated
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "annual_category_update" on public.annual_category for update to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() )
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "annual_category_delete" on public.annual_category for delete to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );

create policy "annual_item_select" on public.annual_item for select to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "annual_item_insert" on public.annual_item for insert to authenticated
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "annual_item_update" on public.annual_item for update to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() )
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "annual_item_delete" on public.annual_item for delete to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );

create policy "annual_value_select" on public.annual_value for select to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "annual_value_insert" on public.annual_value for insert to authenticated
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "annual_value_update" on public.annual_value for update to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() )
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "annual_value_delete" on public.annual_value for delete to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );

grant select, insert, update, delete on table public.annual_group    to authenticated;
grant select, insert, update, delete on table public.annual_category to authenticated;
grant select, insert, update, delete on table public.annual_item     to authenticated;
grant select, insert, update, delete on table public.annual_value    to authenticated;
