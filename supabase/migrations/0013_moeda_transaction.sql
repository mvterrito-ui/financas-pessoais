-- =====================================================================
-- 0013_moeda_transaction.sql — Moeda no lançamento do Fluxo de Caixa
-- Permite registrar entradas/saídas em moeda estrangeira (ex: salário em €).
-- O valor é guardado na moeda NATIVA; a conversão pra real é feita no app
-- com a cotação ao vivo (mesma ideia do Patrimônio). Default 'BRL' não
-- mexe em nada do que já existe.
-- =====================================================================

alter table public.transaction
  add column moeda text not null default 'BRL' check (moeda in ('BRL', 'USD', 'EUR'));
