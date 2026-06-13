-- =====================================================================
-- 0006_moeda_patrimonio.sql — moeda por lugar de patrimônio
-- O valor do snapshot é guardado na moeda NATIVA do lugar; o total em real
-- é calculado convertendo (cotação ao vivo) no app.
-- =====================================================================
alter table public.wealth_place
  add column moeda text not null default 'BRL' check (moeda in ('BRL', 'USD', 'EUR'));

-- Ajusta os lugares existentes conforme definido.
update public.wealth_place set moeda = 'USD' where name in ('USD', 'Cripto');
update public.wealth_place set moeda = 'EUR' where name in ('Revolut', 'Buddy');

-- Novos usuários: semeia os lugares já com a moeda certa.
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

    insert into public.wealth_place (tenant_id, name, ordem, moeda) values
      (new_tenant_id, 'XP', 1, 'BRL'), (new_tenant_id, 'BTC', 2, 'BRL'),
      (new_tenant_id, 'Cripto', 3, 'USD'), (new_tenant_id, 'USD', 4, 'USD'),
      (new_tenant_id, 'Revolut', 5, 'EUR'), (new_tenant_id, 'Buddy', 6, 'EUR'),
      (new_tenant_id, 'BB', 7, 'BRL'), (new_tenant_id, 'Reserva', 8, 'BRL');

    return new;
  end;
  $$;
