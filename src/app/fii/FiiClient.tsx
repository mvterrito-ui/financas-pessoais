'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Plus, Trash2, Wallet, TrendingUp, TrendingDown, Percent } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePromptDialog } from '@/components/ui/prompt'
import { formatBRL } from '@/server/fluxo/fluxo.calc'
import {
  investido,
  lucro,
  retornoPct,
  totais,
  valorAtual,
  type Fii,
  type Quotes,
} from '@/server/fii/fii.calc'

export default function FiiClient() {
  const router = useRouter()
  const ask = usePromptDialog()
  const [fiis, setFiis] = useState<Fii[]>([])
  const [quotes, setQuotes] = useState<Quotes>({})
  const [erro, setErro] = useState<string | null>(null)

  const api = useCallback(
    async (url: string, init?: RequestInit) => {
      const res = await fetch(url, init)
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
      setFiis(await api('/api/fii'))
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [api])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Busca cotação ao vivo sempre que a lista de tickers muda.
  const tickers = useMemo(() => fiis.map((f) => f.ticker).join(','), [fiis])
  useEffect(() => {
    if (!tickers) return
    api(`/api/fii/quote?tickers=${tickers}`)
      .then((d) => setQuotes(d.precos ?? {}))
      .catch(() => {})
  }, [tickers, api])

  async function salvar(id: string, campo: 'quantidade' | 'preco_medio', valor: string) {
    setErro(null)
    try {
      await api(`/api/fii/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: Number(valor) || 0 }),
      })
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function novoFii() {
    const v = await ask({
      title: 'Novo FII',
      fields: [
        { name: 'ticker', label: 'Ticker', placeholder: 'BTLG11' },
        { name: 'quantidade', label: 'Quantas cotas?', type: 'number' },
        { name: 'preco_medio', label: 'Preço médio (R$)', type: 'number' },
      ],
    })
    if (!v?.ticker) return
    await api('/api/fii', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker: v.ticker,
        quantidade: Number(v.quantidade) || 0,
        preco_medio: Number(v.preco_medio) || 0,
      }),
    })
    await carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Remover este FII?')) return
    await api(`/api/fii/${id}`, { method: 'DELETE' })
    await carregar()
  }

  const t = totais(fiis, quotes)

  return (
    <PageLayout
      title="FIIs"
      description="Seus fundos imobiliários (cotação ao vivo)"
      icon={Building2}
      actions={
        <Button onClick={novoFii}>
          <Plus /> Novo FII
        </Button>
      }
    >
      {/* KPIs */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Investido" value={formatBRL(t.aplicado)} icon={Wallet} />
        <StatCard label="Valor atual" value={formatBRL(t.atual)} icon={Building2} accent="primary" />
        <StatCard
          label="Lucro / Prejuízo"
          value={formatBRL(t.resultado)}
          icon={t.resultado >= 0 ? TrendingUp : TrendingDown}
          accent={t.resultado >= 0 ? 'success' : 'destructive'}
        />
        <StatCard
          label="Retorno"
          value={
            t.retorno === null
              ? '—'
              : `${t.retorno >= 0 ? '+' : ''}${t.retorno.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
          }
          icon={Percent}
          accent={t.retorno === null ? 'default' : t.retorno >= 0 ? 'success' : 'destructive'}
          highlight
        />
      </div>

      {erro && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      {fiis.length === 0 ? (
        <EmptyState
          emoji="🏢"
          titulo="Nenhum FII ainda"
          descricao="Adicione seus fundos imobiliários (ticker, cotas e preço médio)."
          acao={
            <Button onClick={novoFii}>
              <Plus /> Novo FII
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Ticker</th>
                <th className="px-4 py-3 font-medium">Cotas</th>
                <th className="px-4 py-3 font-medium">Preço médio</th>
                <th className="px-4 py-3 font-medium">Preço atual</th>
                <th className="px-4 py-3 text-right font-medium">Valor atual</th>
                <th className="px-4 py-3 text-right font-medium">L/P</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {fiis.map((f) => {
                const preco = quotes[f.ticker]
                const lp = lucro(f, quotes)
                const ret = retornoPct(investido(f), lp)
                return (
                  <tr key={f.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-semibold">{f.ticker}</td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        step="0.0001"
                        defaultValue={String(f.quantidade)}
                        className="h-9 w-24"
                        onBlur={(e) => salvar(f.id, 'quantidade', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={String(f.preco_medio)}
                        className="h-9 w-28"
                        onBlur={(e) => salvar(f.id, 'preco_medio', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {preco == null ? '—' : formatBRL(preco)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatBRL(valorAtual(f, quotes))}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold tabular-nums ${lp >= 0 ? 'text-emerald-600' : 'text-destructive'}`}
                    >
                      {lp >= 0 ? '+' : ''}
                      {formatBRL(lp)}
                      {ret !== null && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({ret >= 0 ? '+' : ''}
                          {ret.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => excluir(f.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/30 font-semibold">
                <td className="px-4 py-3" colSpan={4}>
                  Total
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-primary">
                  {formatBRL(t.atual)}
                </td>
                <td
                  className={`px-4 py-3 text-right tabular-nums ${t.resultado >= 0 ? 'text-emerald-600' : 'text-destructive'}`}
                >
                  {t.resultado >= 0 ? '+' : ''}
                  {formatBRL(t.resultado)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </PageLayout>
  )
}
