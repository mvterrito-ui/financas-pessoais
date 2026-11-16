-- =====================================================================
-- 0024_conta_na_fatia.sql — conta vinculada a uma fatia do Orçamento
--
-- O Orçamento volta a ter fatias livres (budget_bucket: nome + % das
-- entradas do mês). Cada conta pode apontar pra uma fatia: as saídas
-- lançadas nessa conta contam como uso da fatia.
--
-- Não apaga nada. Seguro pra rodar mais de uma vez.
-- =====================================================================

alter table public.account
  add column if not exists budget_id uuid references public.budget_bucket (id) on delete set null;
create index if not exists account_budget_id_idx on public.account (budget_id);
