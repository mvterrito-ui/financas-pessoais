-- =====================================================================
-- 0021_ligacao_fluxo_anual.sql — Fluxo de Caixa alimenta o Controle Anual
-- Cada CATEGORIA do Fluxo pode apontar pra UM item do Controle Anual. O item
-- ligado mostra, por mês, a soma dos lançamentos dessas categorias.
-- (Uma categoria -> um item: assim nada é contado duas vezes.)
-- Seguro pra rodar mais de uma vez.
-- =====================================================================
alter table public.category
  add column if not exists annual_item_id uuid references public.annual_item (id) on delete set null;

create index if not exists category_annual_item_id_idx on public.category (annual_item_id);
