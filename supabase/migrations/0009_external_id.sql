-- =====================================================================
-- 0009_external_id.sql — id externo do lançamento (dedup de importação)
-- Guarda o id da transação na origem (ex: FITID do OFX). Índice único
-- (por tenant) garante que reimportar a mesma fatura não duplica.
-- =====================================================================
alter table public.transaction add column external_id text;

create unique index transaction_external_id_idx
  on public.transaction (tenant_id, external_id)
  where external_id is not null;
