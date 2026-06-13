-- =====================================================================
-- 0005_patrimonio.sql — Módulo Patrimônio (foto mensal)
-- wealth_place    = lugar onde o dinheiro está (XP, BTC, Reserva...)
-- wealth_snapshot = a foto: quanto tinha naquele lugar, naquele mês.
-- Um snapshot por (lugar, mês) -> unique, e upsert no importador/edição.
-- =====================================================================

create table public.wealth_place (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant (id) on delete cascade,
  name       text not null,
  ordem      int not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);
create index wealth_place_tenant_id_idx on public.wealth_place (tenant_id);

create table public.wealth_snapshot (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant (id) on delete cascade,
  place_id   uuid not null references public.wealth_place (id) on delete cascade,
  mes        date not null,
  valor      numeric(14,2) not null check (valor >= 0),
  created_at timestamptz not null default now(),
  unique (place_id, mes)
);
create index wealth_snapshot_tenant_id_idx on public.wealth_snapshot (tenant_id);

alter table public.wealth_place    enable row level security;
alter table public.wealth_snapshot enable row level security;

-- Políticas (4 por tabela) — sempre "só o seu tenant".
create policy "wealth_place_select" on public.wealth_place for select to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "wealth_place_insert" on public.wealth_place for insert to authenticated
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "wealth_place_update" on public.wealth_place for update to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() )
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "wealth_place_delete" on public.wealth_place for delete to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );

create policy "wealth_snapshot_select" on public.wealth_snapshot for select to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "wealth_snapshot_insert" on public.wealth_snapshot for insert to authenticated
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "wealth_snapshot_update" on public.wealth_snapshot for update to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() )
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "wealth_snapshot_delete" on public.wealth_snapshot for delete to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );

grant select, insert, update, delete on table public.wealth_place    to authenticated;
grant select, insert, update, delete on table public.wealth_snapshot to authenticated;

-- Semeia os lugares para os tenants que JÁ existem.
insert into public.wealth_place (tenant_id, name, ordem)
select t.id, p.name, p.ord
from public.tenant t
cross join (values
  ('XP', 1), ('BTC', 2), ('Cripto', 3), ('USD', 4),
  ('Revolut', 5), ('Buddy', 6), ('BB', 7), ('Reserva', 8)
) as p(name, ord);

-- Atualiza o gatilho de novo usuário pra criar profile + baldes + lugares.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public
  as $$
  declare new_tenant_id uuid;
  begin
    insert into public.tenant (name)
      values (coalesce(new.raw_user_meta_data->>'name', new.email))
      returning id into new_tenant_id;

    insert into public.profile (id, name, role, tenant_id)
      values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), 'member', new_tenant_id);

    insert into public.budget_bucket (tenant_id, name, percentual, ordem) values
      (new_tenant_id, 'Geral', 50, 1), (new_tenant_id, 'XP', 10, 2), (new_tenant_id, 'Reserva', 10, 3),
      (new_tenant_id, 'Diversão', 10, 4), (new_tenant_id, 'Doações', 10, 5), (new_tenant_id, 'Estudos', 10, 6);

    insert into public.wealth_place (tenant_id, name, ordem) values
      (new_tenant_id, 'XP', 1), (new_tenant_id, 'BTC', 2), (new_tenant_id, 'Cripto', 3), (new_tenant_id, 'USD', 4),
      (new_tenant_id, 'Revolut', 5), (new_tenant_id, 'Buddy', 6), (new_tenant_id, 'BB', 7), (new_tenant_id, 'Reserva', 8);

    return new;
  end;
  $$;
