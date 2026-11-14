-- =====================================================================
-- 0022_recorrente_ate.sql — gasto fixo que SE REPETE, com fim
-- repete = true  -> o lançamento se repete todo mês (no mesmo dia) a partir
--                   da data dele. As repetições são calculadas no app.
-- recorrente_ate -> último mês (dia 01) em que ainda acontece; NULL = sempre.
-- O antigo "recorrente" continua sendo só a etiqueta "fixo" (lançamentos já
-- existentes NÃO passam a se repetir — evita contar em dobro quem lançava à
-- mão todo mês). Seguro pra rodar mais de uma vez.
-- =====================================================================
alter table public.transaction add column if not exists repete boolean not null default false;
alter table public.transaction add column if not exists recorrente_ate date;

create index if not exists transaction_repete_idx
  on public.transaction (tenant_id) where repete and ativo;
