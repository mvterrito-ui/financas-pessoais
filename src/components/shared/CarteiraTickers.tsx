'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Wallet, TrendingUp, TrendingDown, Percent, type LucideIcon } from 'lucide-react'
import { invalidarSincronizacao } from '@/lib/sincronizar'
import { NovoAtivoDialog, type NovoAtivo, type TipoAtivo } from './NovoAtivoDialog'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MoneyCommit } from '@/components/ui/money-input'
import { NumberCommit } from '@/components/ui/number-field'
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

export type CarteiraConfig = {
  /** Base da API: '/api/fii' ou '/api/acao' (cotação em `${api}/quote`). */
  api: string
  titulo: string
  descricao: string
  icon: LucideIcon
  /** "FII", "ação"... usado nos botões e confirmações. */
  nome: string
  novoLabel: string
  vazioTitulo: string
  vazioDescricao: string
  tickerExemplo: string
  qtdLabel: string
  /** Pra busca/confirmação do código (e aviso se o tipo não bater). */
  tipoAtivo: TipoAtivo
}

/**
 * Tela de carteira por ticker (FIIs, Ações): posição = ticker + quantidade +
 * preço médio, com cotação ao vivo. Cada módulo só passa a config.
 */
export function CarteiraTickers({ config: c }: { config: CarteiraConfig }) {
  const Icon = c.icon
  const router = useRouter()
  const [itens, setItens] = useState<Fii[]>([])
  const [quotes, setQuotes] = useState<Quotes>({})
  const [erro, setErro] = useState<string | null>(null)

  const api = useCallback(
    async (url: string, init?: RequestInit) => {
      // Mexeu num investimento -> o Patrimônio sincroniza na próxima visita.
      if (init?.method && init.method !== 'GET') invalidarSincronizacao()
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
      setItens(await api(c.api))
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [api, c.api])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Busca cotação ao vivo sempre que a lista de tickers muda.
  const tickers = useMemo(() => itens.map((f) => f.ticker).join(','), [itens])
  useEffect(() => {
    if (!tickers) return
    api(`${c.api}/quote?tickers=${tickers}`)
      .then((d) => setQuotes(d.precos ?? {}))
      .catch(() => {})
  }, [tickers, api, c.api])

  async function salvar(id: string, campo: 'quantidade' | 'preco_medio', valor: string) {
    setErro(null)
    try {
      await api(`${c.api}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: Number(valor) || 0 }),
      })
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  const [novoAberto, setNovoAberto] = useState(false)
  const novo = () => setNovoAberto(true)

  async function salvarNovo(a: NovoAtivo) {
    await api(c.api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(a),
    })
    await carregar()
  }

  async function excluir(id: string) {
    try {
      if (!confirm(`Remover esta posição (${c.nome})?`)) return
      await api(`${c.api}/${id}`, { method: 'DELETE' })
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  const t = totais(itens, quotes)

  return (
    <PageLayout
      title={c.titulo}
      description={c.descricao}
      icon={Icon}
      actions={
        <Button onClick={novo}>
          <Plus /> {c.novoLabel}
        </Button>
      }
    >
      {/* KPIs */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Investido" value={formatBRL(t.aplicado)} icon={Wallet} />
        <StatCard label="Valor atual" value={formatBRL(t.atual)} icon={Icon} accent="primary" />
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

      {itens.length === 0 ? (
        <EmptyState
          icon={c.icon}
          titulo={c.vazioTitulo}
          descricao={c.vazioDescricao}
          acao={
            <Button onClick={novo}>
              <Plus /> {c.novoLabel}
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Ticker</th>
                <th className="px-4 py-3 font-medium">Qtd.</th>
                <th className="px-4 py-3 font-medium">Preço médio</th>
                <th className="px-4 py-3 font-medium">Preço atual</th>
                <th className="px-4 py-3 text-right font-medium">Valor atual</th>
                <th className="px-4 py-3 text-right font-medium">L/P</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((f) => {
                const preco = quotes[f.ticker]
                const lp = lucro(f, quotes)
                const ret = retornoPct(investido(f), lp)
                return (
                  <tr key={f.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-semibold">{f.ticker}</td>
                    <td className="px-4 py-3">
                      <NumberCommit
                        casas={4}
                        aria-label={`Quantidade de ${f.ticker}`}
                        inicial={f.quantidade}
                        className="w-28"
                        onCommit={(v) => salvar(f.id, 'quantidade', v)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <MoneyCommit
                        prefixo="R$"
                        aria-label={`Preço médio de ${f.ticker}`}
                        inicial={f.preco_medio}
                        className="w-32"
                        onCommit={(v) => salvar(f.id, 'preco_medio', v)}
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
                        aria-label="Remover posição"
                        title="Remover posição"
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
          </div>
        </Card>
      )}
      <NovoAtivoDialog
        open={novoAberto}
        tipo={c.tipoAtivo}
        titulo={c.novoLabel}
        qtdLabel={c.qtdLabel}
        exemplo={c.tickerExemplo}
        onClose={() => setNovoAberto(false)}
        onSalvar={salvarNovo}
      />
    </PageLayout>
  )
}
