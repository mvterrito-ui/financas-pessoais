'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatBRL } from '@/server/fluxo/fluxo.calc'
import {
  pctDaReceita,
  serieDoItem,
  total,
  type Grupo,
  type Item,
  type Valores,
  type resumo as resumoFn,
} from '@/server/anual/anual.calc'
import { MESES_CURTOS, TIPOS } from './tipos'

type Resumo = ReturnType<typeof resumoFn>

// Cores das séries: --serie-1/--serie-2 em globals.css (claro e escuro).
// Receita/Despesas são identidade, não status: azul/laranja em vez de verde/vermelho.

const pct = (p: number | null) =>
  p === null ? '' : ` · ${p.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

function Legenda({ itens }: { itens: { cor: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {itens.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.cor }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

// Barras horizontais ordenadas (uma cor): nome, barra e valor na mesma linha.
function BarrasRanqueadas({
  linhas,
  receita,
}: {
  linhas: { id: string; nome: string; detalhe?: string; valor: number }[]
  receita: number
}) {
  const max = Math.max(1, ...linhas.map((l) => l.valor))
  return (
    <ul className="space-y-2.5">
      {linhas.map((l) => (
        <li key={l.id} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 text-sm sm:grid-cols-[minmax(0,11rem)_1fr]">
          <span className="min-w-0">
            <span className="block truncate" title={l.nome}>
              {l.nome}
            </span>
            {l.detalhe && <span className="block text-[11px] text-muted-foreground">{l.detalhe}</span>}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 min-w-0 flex-1 rounded-full bg-muted">
              <span
                className="block h-full rounded-full"
                style={{ width: `${(l.valor / max) * 100}%`, background: 'var(--serie-1)' }}
              />
            </span>
            <span className="w-36 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              <span className="font-medium text-foreground">{formatBRL(l.valor)}</span>
              {pct(pctDaReceita(l.valor, receita))}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export function GraficosAnual({
  grupos,
  itens,
  valores,
  resumo: r,
}: {
  grupos: Grupo[]
  itens: Item[]
  valores: Valores
  resumo: Resumo
}) {
  const receitaAno = total(r.receita)
  const temDados = r.receita.some((v) => v !== undefined) || r.despesa.some((v) => v !== undefined)

  // ---- colunas por mês
  const maxMes = Math.max(1, ...r.receita.map((v) => v ?? 0), ...r.despesa.map((v) => v ?? 0))

  // ---- para onde vai a receita (grupos de despesa/investimento)
  const destinos = grupos
    .filter((g) => g.tipo !== 'receita')
    .map((g) => ({
      id: g.id,
      nome: g.name,
      detalhe: TIPOS[g.tipo].label,
      valor: total(r.porGrupo.get(g.id) ?? []),
    }))
    .filter((l) => l.valor > 0)
    .sort((a, b) => b.valor - a.valor)

  // ---- itens de um grupo (top 8 + Outros)
  const comValor = grupos.filter((g) => total(r.porGrupo.get(g.id) ?? []) > 0)
  const [grupoSel, setGrupoSel] = useState<string | null>(null)
  const grupoAtivo =
    comValor.find((g) => g.id === grupoSel) ?? comValor.find((g) => g.tipo === 'despesa') ?? comValor[0]
  const itensDoGrupo = (() => {
    if (!grupoAtivo) return []
    const linhas = itens
      .filter((i) => i.group_id === grupoAtivo.id)
      .map((i) => ({ id: i.id, nome: i.name, valor: total(serieDoItem(i.id, r.meses, valores)) }))
      .filter((l) => l.valor > 0)
      .sort((a, b) => b.valor - a.valor)
    if (linhas.length <= 8) return linhas
    const resto = linhas.slice(7).reduce((s, l) => s + l.valor, 0)
    return [...linhas.slice(0, 7), { id: 'outros', nome: `Outros (${linhas.length - 7})`, valor: resto }]
  })()

  if (!temDados) return null

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Receita × Despesas por mês */}
      <Card className="p-4 lg:col-span-2">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Receita × despesas por mês</h2>
          <Legenda
            itens={[
              { cor: 'var(--serie-1)', label: 'Receita' },
              { cor: 'var(--serie-2)', label: 'Despesas' },
            ]}
          />
        </div>
        <div className="flex h-56 items-end gap-1 border-b border-border sm:gap-2">
          {r.meses.map((m, i) => {
            const rec = r.receita[i] ?? 0
            const desp = r.despesa[i] ?? 0
            const saldo = r.saldo[i]
            const resumoTxt = `${MESES_CURTOS[i]}: receita ${formatBRL(rec)}, despesas ${formatBRL(desp)}${
              saldo !== undefined ? `, saldo ${formatBRL(saldo)}` : ''
            }`
            return (
              <div
                key={m}
                tabIndex={0}
                aria-label={resumoTxt}
                className="group relative flex h-full flex-1 items-end justify-center gap-0.5 rounded-t-md outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
              >
                <div
                  className="w-full max-w-4 rounded-t-[4px]"
                  style={{ height: `${(rec / maxMes) * 100}%`, background: 'var(--serie-1)' }}
                />
                <div
                  className="w-full max-w-4 rounded-t-[4px]"
                  style={{ height: `${(desp / maxMes) * 100}%`, background: 'var(--serie-2)' }}
                />
                {/* Tooltip */}
                <div
                  className={cn(
                    'pointer-events-none absolute bottom-full z-10 mb-2 hidden w-44 rounded-lg border border-border bg-card p-2.5 text-xs shadow-lg group-hover:block group-focus-visible:block',
                    i > 8 ? 'right-0' : i < 3 ? 'left-0' : 'left-1/2 -translate-x-1/2',
                  )}
                >
                  <div className="mb-1 font-semibold">{MESES_CURTOS[i]}</div>
                  <div className="flex justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="h-2 w-2 rounded-sm" style={{ background: 'var(--serie-1)' }} /> Receita
                    </span>
                    <span className="tabular-nums">{formatBRL(rec)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="h-2 w-2 rounded-sm" style={{ background: 'var(--serie-2)' }} /> Despesas
                    </span>
                    <span className="tabular-nums">{formatBRL(desp)}</span>
                  </div>
                  {saldo !== undefined && (
                    <div className="mt-1 flex justify-between gap-2 border-t border-border pt-1 font-medium">
                      <span>Saldo</span>
                      <span className={cn('tabular-nums', saldo >= 0 ? 'text-success' : 'text-destructive')}>
                        {formatBRL(saldo)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-1.5 flex gap-1 sm:gap-2">
          {MESES_CURTOS.map((m) => (
            <span key={m} className="flex-1 text-center text-[10px] text-muted-foreground">
              {m}
            </span>
          ))}
        </div>
      </Card>

      {/* Para onde vai a receita */}
      <Card className="p-4">
        <h2 className="mb-1 text-sm font-medium text-muted-foreground">Para onde vai a receita</h2>
        <p className="mb-4 text-xs text-muted-foreground">Total do ano por grupo · % da receita do ano</p>
        {destinos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem despesas ou investimentos no ano.</p>
        ) : (
          <BarrasRanqueadas linhas={destinos} receita={receitaAno} />
        )}
      </Card>

      {/* Itens de um grupo */}
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Maiores categorias do grupo</h2>
        {comValor.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {comValor.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGrupoSel(g.id)}
                aria-pressed={g.id === grupoAtivo?.id}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  g.id === grupoAtivo?.id
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}
        {itensDoGrupo.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem valores nesse grupo.</p>
        ) : (
          <BarrasRanqueadas linhas={itensDoGrupo} receita={receitaAno} />
        )}
      </Card>
    </div>
  )
}
