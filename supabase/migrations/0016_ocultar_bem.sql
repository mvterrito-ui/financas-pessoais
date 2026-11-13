-- =====================================================================
-- 0016_ocultar_bem.sql — ocultar um bem manual SEM perder o histórico
-- oculto_desde = NULL       -> bem visível
-- oculto_desde = 'AAAA-MM-01' -> some da lista e deixa de contar a partir
--                              desse mês; meses anteriores continuam no
--                              total e na evolução. "Mostrar" volta pra NULL.
-- (Diferente do "remover" — ativo = false —, que tira o histórico todo.)
-- =====================================================================
alter table public.wealth_place add column oculto_desde date;
