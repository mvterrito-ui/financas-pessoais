-- =====================================================================
-- 0001_foundation.sql — Fundação multi-tenant
-- tenant = dono dos dados (1 por usuário no piloto)
-- profile = liga o usuário do login (auth.users) a um tenant e a um papel
-- =====================================================================

-- 1) Tabelas base ------------------------------------------------------
create table public.tenant (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.profile (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null,
  role       text not null default 'member' check (role in ('manager','member')),
  tenant_id  uuid references public.tenant (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.tenant  enable row level security;
alter table public.profile enable row level security;

-- 2) Funções de apoio (security definer: leem o profile sem disparar o
--    RLS de novo -> evitam recursão infinita nas policies) --------------
create or replace function public.current_tenant_id() returns uuid
  language sql stable security definer set search_path = public
  as $$ select tenant_id from public.profile where id = auth.uid() $$;

create or replace function public.is_manager() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (
    select 1 from public.profile where id = auth.uid() and role = 'manager'
  ) $$;

-- 3) Policies: cada um vê só o seu (manager fica pra futuro, hoje ninguém é) -
create policy "profile_select" on public.profile for select to authenticated
  using ( id = auth.uid() or public.is_manager() );

create policy "tenant_select" on public.tenant for select to authenticated
  using ( id = public.current_tenant_id() or public.is_manager() );

grant select on table public.tenant  to authenticated;
grant select on table public.profile to authenticated;

-- 4) Gatilho: ao cadastrar um usuário, cria o tenant dele e o profile -----
--    (security definer -> roda com permissão total, fura o RLS de propósito)
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
    return new;
  end;
  $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5) GRANT do service_role (chave sb_secret_, usada em scripts admin/import)
--    Sem isto dá "permission denied" mesmo com a chave certa.
grant usage on schema public to service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
