-- =====================================================================
-- 0019_consorcio.sql — Módulo Consórcios
-- consorcio = uma cota: carta de crédito, prazo, parcelas pagas e situação.
-- Pago / falta pagar / % quitado são CALCULADOS no app (não ficam gravados).
-- =====================================================================
create table public.consorcio (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenant (id) on delete cascade,
  nome           text not null,
  administradora text,
  tipo           text not null default 'outro' check (tipo in ('imovel', 'veiculo', 'servico', 'outro')),
  valor_carta    numeric(14,2) not null default 0 check (valor_carta >= 0),
  prazo_meses    int not null check (prazo_meses between 1 and 400),
  parcelas_pagas int not null default 0 check (parcelas_pagas >= 0),
  valor_parcela  numeric(14,2) not null default 0 check (valor_parcela >= 0),
  status         text not null default 'ativo' check (status in ('ativo', 'contemplado', 'encerrado')),
  ativo          boolean not null default true,
  created_at     timestamptz not null default now(),
  check (parcelas_pagas <= prazo_meses)
);
create index consorcio_tenant_id_idx on public.consorcio (tenant_id);

alter table public.consorcio enable row level security;

create policy "consorcio_select" on public.consorcio for select to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "consorcio_insert" on public.consorcio for insert to authenticated
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "consorcio_update" on public.consorcio for update to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() )
  with check ( tenant_id = public.current_tenant_id() or public.is_manager() );
create policy "consorcio_delete" on public.consorcio for delete to authenticated
  using ( tenant_id = public.current_tenant_id() or public.is_manager() );

grant select, insert, update, delete on table public.consorcio to authenticated;
