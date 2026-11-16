-- =====================================================================
-- 0024_fatia_no_lancamento.sql — a fatia do Orçamento no lugar da conta
--
-- O Orçamento volta a ter fatias livres (budget_bucket: nome + % das
-- entradas do mês). A saída aponta direto pra uma fatia, que substitui a
-- antiga "conta" no app. A tabela account e as colunas account_id ficam
-- no banco (histórico), mas o app não usa mais.
--
-- Lançamentos e recorrências cuja conta tem o mesmo nome de uma fatia
-- já entram nela.
--
-- Não apaga nada. Seguro pra rodar mais de uma vez.
-- =====================================================================

alter table public.transaction
  add column if not exists budget_id uuid references public.budget_bucket (id) on delete set null;
create index if not exists transaction_budget_id_idx on public.transaction (budget_id);

alter table public.recorrencia
  add column if not exists budget_id uuid references public.budget_bucket (id) on delete set null;

-- conta com o mesmo nome de uma fatia (do mesmo usuário) -> essa fatia
update public.transaction t
   set budget_id = b.id
  from public.account a
  join public.budget_bucket b
    on b.tenant_id = a.tenant_id and b.ativo and lower(trim(b.name)) = lower(trim(a.name))
 where t.account_id = a.id and t.budget_id is null and t.tipo = 'saida';

update public.recorrencia r
   set budget_id = b.id
  from public.account a
  join public.budget_bucket b
    on b.tenant_id = a.tenant_id and b.ativo and lower(trim(b.name)) = lower(trim(a.name))
 where r.account_id = a.id and r.budget_id is null and r.tipo = 'saida';
