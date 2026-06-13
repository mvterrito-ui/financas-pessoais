-- =====================================================================
-- 0003_origem.sql — procedência do lançamento (manual x importado)
-- Permite reimportar o histórico sem duplicar nem mexer no que foi
-- lançado à mão: o importador só apaga/recria as linhas origem = 'import'.
-- =====================================================================
alter table public.transaction
  add column origem text not null default 'manual'
  check (origem in ('manual', 'import'));
