-- =====================================================================
-- 0015_patrimonio_investimentos.sql — Patrimônio alimentado pelos módulos
-- origem = NULL      -> lugar MANUAL (você digita o valor: conta, imóvel...)
-- origem = 'acao' | 'fii' | 'renda_fixa' | 'cripto'
--                    -> lugar AUTOMÁTICO: o app calcula o valor a partir do
--                       módulo e grava a foto do mês atual.
-- Os lugares automáticos são criados pelo app na 1ª sincronização.
-- unique (tenant_id, origem): 1 lugar por módulo (NULLs não colidem).
-- =====================================================================
alter table public.wealth_place
  add column origem text check (origem in ('acao', 'fii', 'renda_fixa', 'cripto'));

alter table public.wealth_place
  add constraint wealth_place_tenant_origem_key unique (tenant_id, origem);
