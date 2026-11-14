-- =====================================================================
-- 0018_novo_usuario_sem_dados.sql — conta nova começa VAZIA
-- O gatilho criava, pra todo usuário novo, os baldes e os lugares pessoais
-- do dono (XP, BTC, Revolut, "Diversão"...). Além de não fazer sentido pra
-- outra pessoa, o "Cripto" manual duplicava o "Cripto" automático (0015).
-- Agora cria só o tenant e o profile; o resto o usuário monta (os lugares
-- automáticos de investimentos o app cria na 1ª sincronização).
-- Não mexe em dados de quem já existe.
-- =====================================================================
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

    return new;
  end;
  $$;
