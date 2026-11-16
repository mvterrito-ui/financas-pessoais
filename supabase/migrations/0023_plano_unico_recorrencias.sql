-- =====================================================================
-- 0023_plano_unico_recorrencias.sql — Caixa reorganizado
--
-- 1) PLANO DE CONTAS ÚNICO: o lançamento passa a apontar direto pra uma
--    categoria do plano (annual_item). As categorias antigas do Fluxo viram
--    categorias do plano (as já ligadas reaproveitam o item ligado).
-- 2) RECORRÊNCIAS: receitas/despesas fixas com estado (ativa, pausada,
--    finalizada), histórico de valor e pausas. Cada mês gera uma PREVISÃO;
--    ao confirmar, vira um lançamento (recorrencia_id + competencia).
--    Os lançamentos "repetir todo mês" (0022) viram recorrências.
-- 3) METAS: cada grupo do plano pode ter meta em % da receita.
--
-- Não apaga nada. Seguro pra rodar mais de uma vez.
-- =====================================================================

-- ---------- 3) metas por grupo
alter table public.annual_group
  add column if not exists meta_pct numeric(5,2) check (meta_pct is null or (meta_pct >= 0 and meta_pct <= 100));

-- ---------- 2) recorrências
create table if not exists public.recorrencia (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant (id) on delete cascade,
  tipo       text not null check (tipo in ('entrada', 'saida')),
  descricao  text not null,
  valor      numeric(14,2) not null check (valor > 0),      -- valor inicial
  moeda      text not null default 'BRL' check (moeda in ('BRL', 'USD', 'EUR')),
  item_id    uuid references public.annual_item (id) on delete set null,
  account_id uuid references public.account (id) on delete set null,
  dia        int not null default 1 check (dia between 1 and 31),
  inicio     date not null check (extract(day from inicio) = 1),   -- 1º mês
  fim        date check (fim is null or extract(day from fim) = 1), -- último mês (null = sem fim)
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);
create index if not exists recorrencia_tenant_id_idx on public.recorrencia (tenant_id);

-- Pausa: não gera previsão de `de` até `ate` (inclusive). ate null = pausada até retomar.
create table if not exists public.recorrencia_pausa (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenant (id) on delete cascade,
  recorrencia_id uuid not null references public.recorrencia (id) on delete cascade,
  de             date not null check (extract(day from de) = 1),
  ate            date check (ate is null or extract(day from ate) = 1),
  created_at     timestamptz not null default now(),
  check (ate is null or ate >= de)
);
create index if not exists recorrencia_pausa_tenant_id_idx on public.recorrencia_pausa (tenant_id);

-- Valor a partir de um mês (reajuste de aluguel, aumento de salário...).
create table if not exists public.recorrencia_valor (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenant (id) on delete cascade,
  recorrencia_id uuid not null references public.recorrencia (id) on delete cascade,
  a_partir       date not null check (extract(day from a_partir) = 1),
  valor          numeric(14,2) not null check (valor > 0),
  created_at     timestamptz not null default now(),
  unique (recorrencia_id, a_partir)
);
create index if not exists recorrencia_valor_tenant_id_idx on public.recorrencia_valor (tenant_id);

alter table public.recorrencia       enable row level security;
alter table public.recorrencia_pausa enable row level security;
alter table public.recorrencia_valor enable row level security;

do $$
declare t text;
begin
  foreach t in array array['recorrencia', 'recorrencia_pausa', 'recorrencia_valor'] loop
    execute format('drop policy if exists "%1$s_select" on public.%1$s', t);
    execute format('create policy "%1$s_select" on public.%1$s for select to authenticated using (tenant_id = public.current_tenant_id() or public.is_manager())', t);
    execute format('drop policy if exists "%1$s_insert" on public.%1$s', t);
    execute format('create policy "%1$s_insert" on public.%1$s for insert to authenticated with check (tenant_id = public.current_tenant_id() or public.is_manager())', t);
    execute format('drop policy if exists "%1$s_update" on public.%1$s', t);
    execute format('create policy "%1$s_update" on public.%1$s for update to authenticated using (tenant_id = public.current_tenant_id() or public.is_manager()) with check (tenant_id = public.current_tenant_id() or public.is_manager())', t);
    execute format('drop policy if exists "%1$s_delete" on public.%1$s', t);
    execute format('create policy "%1$s_delete" on public.%1$s for delete to authenticated using (tenant_id = public.current_tenant_id() or public.is_manager())', t);
    execute format('grant select, insert, update, delete on table public.%1$s to authenticated', t);
  end loop;
end $$;

-- ---------- 1) lançamento aponta pro plano (+ vínculo com a recorrência)
alter table public.transaction
  add column if not exists item_id uuid references public.annual_item (id) on delete set null;
alter table public.transaction
  add column if not exists recorrencia_id uuid references public.recorrencia (id) on delete set null;
alter table public.transaction
  add column if not exists competencia date check (competencia is null or extract(day from competencia) = 1);
create index if not exists transaction_item_id_idx on public.transaction (item_id);
-- 1 confirmação por recorrência por mês
create unique index if not exists transaction_recorrencia_mes_idx
  on public.transaction (recorrencia_id, competencia)
  where recorrencia_id is not null and ativo;

-- ---------- migração dos dados existentes (por tenant)
do $$
declare
  c record;
  r record;
  g_receita uuid;
  g_despesa uuid;
  novo_item uuid;
  nova_rec uuid;
begin
  -- a) categoria do Fluxo sem item ligado -> vira categoria do plano
  for c in
    select * from public.category
    where ativo and annual_item_id is null
    order by tenant_id, tipo, name
  loop
    if c.tipo = 'entrada' then
      select id into g_receita from public.annual_group
        where tenant_id = c.tenant_id and ativo and tipo = 'receita' order by ordem, created_at limit 1;
      if g_receita is null then
        insert into public.annual_group (tenant_id, name, tipo, ordem)
          values (c.tenant_id, 'Receitas', 'receita', 0) returning id into g_receita;
      end if;
      insert into public.annual_item (tenant_id, group_id, name, ordem)
        values (c.tenant_id, g_receita, c.name,
                coalesce((select max(ordem) + 1 from public.annual_item where group_id = g_receita), 1))
        returning id into novo_item;
    else
      select id into g_despesa from public.annual_group
        where tenant_id = c.tenant_id and ativo and tipo = 'despesa' order by ordem, created_at limit 1;
      if g_despesa is null then
        insert into public.annual_group (tenant_id, name, tipo, ordem)
          values (c.tenant_id, 'Despesas', 'despesa', 10) returning id into g_despesa;
      end if;
      insert into public.annual_item (tenant_id, group_id, name, ordem)
        values (c.tenant_id, g_despesa, c.name,
                coalesce((select max(ordem) + 1 from public.annual_item where group_id = g_despesa), 1))
        returning id into novo_item;
    end if;
    update public.category set annual_item_id = novo_item where id = c.id;
    g_receita := null;
    g_despesa := null;
  end loop;

  -- b) lançamentos herdam a categoria do plano
  update public.transaction t
     set item_id = cat.annual_item_id
    from public.category cat
   where t.category_id = cat.id and t.item_id is null and cat.annual_item_id is not null;

  -- c) "repetir todo mês" (0022) -> recorrência; o lançamento original vira
  --    a confirmação do 1º mês
  for r in select * from public.transaction where repete and ativo loop
    insert into public.recorrencia
      (tenant_id, tipo, descricao, valor, moeda, item_id, account_id, dia, inicio, fim)
    values
      (r.tenant_id, r.tipo, coalesce(nullif(r.descricao, ''), 'Recorrência'), r.valor, coalesce(r.moeda, 'BRL'),
       r.item_id, r.account_id, extract(day from r.data)::int,
       date_trunc('month', r.data)::date, r.recorrente_ate)
    returning id into nova_rec;
    update public.transaction
       set recorrencia_id = nova_rec,
           competencia = date_trunc('month', r.data)::date,
           repete = false
     where id = r.id;
  end loop;
end $$;
