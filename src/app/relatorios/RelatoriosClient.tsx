'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, ArrowUpRight, ArrowDownRight, Scale } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MonthPicker } from '@/components/ui/month-picker'
import { hojeISO, fimDoMes, rotuloMes } from '@/lib/utils'
import {
  formatBRL,
  saldo,
  totalEntradas,
  totalSaidas,
  porCategoria,
  type Category,
  type Transaction,
  type CategoriaResumo,
} from '@/server/fluxo/fluxo.calc'
import { useRates } from '@/lib/useRates'

// Uma quebra (lista de categorias com barra + %).
function Quebra({
  titulo,
  itens,
  cor,
}: {
  titulo: string
  itens: CategoriaResumo[]
  cor: 'destructive' | 'emerald'
}) {
  const max = Math.max(1, ...itens.map((i) => i.total))
  const barra = cor === 'destructive' ? 'bg-destructive/80' : 'bg-emerald-500/80'
  const texto = cor === 'destructive' ? 'text-destructive' : 'text-emerald-600'
  return (
    <Card className="p-4">
      <div className="mb-3 text-sm font-medium text-muted-foreground">{titulo}</div>
      {itens.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nada nesse período.
        </p>
      ) : (
        <div className="space-y-3">
          {itens.map((c) => (
            <div key={c.id ?? 'sem'} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="tabular-nums">
                  <span className={`font-semibold ${texto}`}>{formatBRL(c.total)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {c.pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                  </span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${barra}`}
                  style={{ width: `${Math.max(2, (c.total / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function RelatoriosClient() {
  const router = useRouter()
  const rates = useRates()
  const [txs, setTxs] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [mes, setMes] = useState(hojeISO().slice(0, 7))
  const [todoPeriodo, setTodoPeriodo] = useState(false)

  const api = useCallback(
    async (url: string) => {
      const res = await fetch(url)
      if (res.status === 401) {
        router.push('/login')
        throw new Error('Sessão expirada')
      }
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? 'Erro na requisição')
      return body
    },
    [router],
  )

  const carregar = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (!todoPeriodo) {
        params.set('de', `${mes}-01`)
        params.set('ate', fimDoMes(mes))
      }
      const qs = params.toString()
      const [t, c] = await Promise.all([
        api('/api/transaction' + (qs ? `?${qs}` : '')),
        api('/api/category'),
      ])
      setTxs(t)
      setCategories(c)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [api, mes, todoPeriodo])

  useEffect(() => {
    carregar()
  }, [carregar])

  const gastos = useMemo(() => porCategoria(txs, categories, 'saida', rates), [txs, categories, rates])
  const entradas = useMemo(() => porCategoria(txs, categories, 'entrada', rates), [txs, categories, rates])
  const resultado = saldo(txs, rates)

  return (
    <PageLayout
      title="Relatórios"
      description="Pra onde vai e de onde vem o seu dinheiro, por categoria"
      icon={BarChart3}
    >
      {/* Período */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Período</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={todoPeriodo ? 'default' : 'outline'}
              onClick={() => setTodoPeriodo((v) => !v)}
            >
              Todo período
            </Button>
            {!todoPeriodo && <MonthPicker value={mes} onChange={setMes} />}
          </div>
        </div>
        <span className="ml-auto self-center text-sm text-muted-foreground">
          📅 {todoPeriodo ? 'Todo o período' : rotuloMes(mes)} · {txs.length} lançamento
          {txs.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Entradas" value={formatBRL(totalEntradas(txs, rates))} icon={ArrowUpRight} accent="success" />
        <StatCard label="Saídas" value={formatBRL(totalSaidas(txs, rates))} icon={ArrowDownRight} accent="destructive" />
        <StatCard
          label="Saldo"
          value={formatBRL(resultado)}
          icon={Scale}
          accent={resultado >= 0 ? 'success' : 'destructive'}
          highlight
        />
      </div>

      {erro && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      {txs.length === 0 ? (
        <EmptyState
          emoji="📊"
          titulo="Nada pra relatar nesse período"
          descricao="Lance entradas e saídas no Fluxo de Caixa pra ver a quebra por categoria aqui."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Quebra titulo="🔻 Gastos por categoria" itens={gastos} cor="destructive" />
          <Quebra titulo="🔺 Entradas por categoria" itens={entradas} cor="emerald" />
        </div>
      )}
    </PageLayout>
  )
}
