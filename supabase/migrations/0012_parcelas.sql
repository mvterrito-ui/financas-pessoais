-- =====================================================================
-- 0012_parcelas.sql — Compras parceladas no Fluxo de Caixa
--
-- Uma compra de R$1.200 em 12x vira 12 lançamentos (um por mês). Pra saber
-- que eles são "a mesma compra", marcamos os três campos abaixo:
--   parcela_grupo = id que une as 12 linhas (pra ver/excluir juntas)
--   parcela_num   = qual parcela é esta (1, 2, 3...)
--   parcela_total = quantas parcelas no total (12)
-- Lançamento à vista (o normal) fica com os três NULL.
-- =====================================================================

alter table public.transaction
  add column parcela_grupo uuid,
  add column parcela_num   int,
  add column parcela_total int;

-- Busca rápida por grupo (ex: "me dá as 12 parcelas desta compra").
create index transaction_parcela_grupo_idx
  on public.transaction (parcela_grupo)
  where parcela_grupo is not null;
