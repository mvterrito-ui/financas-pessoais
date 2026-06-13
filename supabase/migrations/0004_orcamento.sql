-- =====================================================================
-- 0004_orcamento.sql — Módulo Orçamento (regra de divisão da renda)
-- budget_bucket = "balde": uma fatia da renda (Geral 50%, XP 10%, ...).
-- A divisão (renda × %) é cálculo puro no app, não fica gravada.
-- =====================================================================

create table public.budget_bucket (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant (id) on delete cascade,
  name       text not null,
  percentual numeric(5,2) not null check (percentual >= 0 and percentual <= 100),
  ordem      int not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);
create index budget_bucket_tenant_id_idx on public.budget_bucket (tenant_id);

alter table public.budget_bucket enable row level security;

create policy "budget_bucket_select" on public.budget_bucket for select to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "budget_bucket_insert" on public.budget_bucket for insert to authenticated
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "budget_bucket_update" on public.budget_bucket for update to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() )
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "budget_bucket_delete" on public.budget_bucket for delete to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );

grant select, insert, update, delete on table public.budget_bucket to authenticated;

-- Semeia os baldes 50/10/10 para os tenants que JÁ existem.
insert into public.budget_bucket (tenant_id, name, percentual, ordem)
select t.id, b.name, b.pct, b.ord
from public.tenant t
cross join (values
  ('Geral', 50, 1),
  ('XP', 10, 2),
  ('Reserva', 10, 3),
  ('Diversão', 10, 4),
  ('Doações', 10, 5),
  ('Estudos', 10, 6)
) as b(name, pct, ord);

-- Atualiza o gatilho de novo usuário pra já criar os baldes padrão também.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public
  as $$
  declare new_tenant_id uuid;
  begin
    insert into public.tenant (name)
      values (coalesce(new.raw_user_meta_data->>'name', new.email))
      returning id into new_tenant_id;

    insert into public.profile (id, name, role, tenant_id)
      values (
        new.id,
        coalesce(new.raw_user_meta_data->>'name', new.email),
        'member',
        new_tenant_id
      );

    insert into public.budget_bucket (tenant_id, name, percentual, ordem)
    values
      (new_tenant_id, 'Geral', 50, 1),
      (new_tenant_id, 'XP', 10, 2),
      (new_tenant_id, 'Reserva', 10, 3),
      (new_tenant_id, 'Diversão', 10, 4),
      (new_tenant_id, 'Doações', 10, 5),
      (new_tenant_id, 'Estudos', 10, 6);

    return new;
  end;
  $$;
