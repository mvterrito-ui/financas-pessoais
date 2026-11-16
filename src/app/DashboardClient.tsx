'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  TrendingUp,
  Building2,
  CandlestickChart,
  Bitcoin,
  Landmark,
  ArrowLeftRight,
  Target,
  Repeat,
} from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { Card } from '@/components/ui/card'
import { MonthPicker } from '@/components/ui/month-picker'
import { Label } from '@/components/ui/label'
import { hojeISO, fimDoMes, rotuloMes } from '@/lib/utils'
import {
  formatBRL,
  saldo,
  totalEntradas,
  totalSaidas,
  valorEmBRL,
  type Transaction,
} from '@/server/fluxo/fluxo.calc'
import {
  evolucaoBRL,
  variacaoPct,
  type Moeda,
  type WealthPlace,
  type WealthSnapshot,
} from '@/server/patrimonio/patrimonio.calc'
import { totais as fiiTotais, type Fii, type Quotes } from '@/server/fii/fii.calc'
import { totais as rfTotais, type FixedIncome } from '@/server/renda-fixa/renda-fixa.calc'
import { totais as cryptoTotais, type CryptoSummary } from '@/server/cripto/cripto.calc'
import { metaFora, pctDaReceita, textoMeta, type Grupo, type Item } from '@/server/anual/anual.calc'
import { sincronizarPatrimonio } from '@/lib/sincronizar'
import { useCotacao } from '@/lib/useRates'

const ANO_ATUAL = Number(hojeISO().slice(0, 4))

export default function DashboardClient() {
  const router = useRouter()
  const [mes, setMes] = useState(hojeISO().slice(0, 7))
  const { rates } = useCotacao()

  const [txs, setTxs] = useState<Transaction[]>([])
  const [places, setPlaces] = useState<WealthPlace[]>([])
  const [snaps, setSnaps] = useState<WealthSnapshot[]>([])
  const [fiis, setFiis] = useState<Fii[]>([])
  const [fiiQuotes, setFiiQuotes] = useState<Quotes>({})
  const [acoes, setAcoes] = useState<Fii[]>([])
  const [acaoQuotes, setAcaoQuotes] = useState<Quotes>({})
  const [rendaFixa, setRendaFixa] = useState<FixedIncome[]>([])
  const [cryptos, setCryptos] = useState<CryptoSummary[]>([])
  const [plano, setPlano] = useState<{ grupos: Grupo[]; itens: Item[] }>({ grupos: [], itens: [] })

  const api = useCallback(
    async (url: string) => {
      const res = await fetch(url)
      if (res.status === 401) {
        router.push('/login')
        throw new Error('Sessão expirada')
      }
      const body = await res.json().catch(() => null)
      // Erro NUNCA vira dado: antes um 500 ({ error }) ia pro estado e o
      // .map() quebrava a página inteira.
      if (!res.ok) throw new Error(body?.error ?? 'Erro na requisição')
      return body
    },
    [router],
  )
  const [erro, setErro] = useState<string | null>(null)
  const falhou = useCallback((e: unknown) => setErro((e as Error).message), [])

  // Carrega tudo (uma vez) e a cotação. Em paralelo, atualiza a foto do mês
  // no Patrimônio (em segundo plano) e, se atualizou, recarrega só o patrimônio.
  useEffect(() => {
    Promise.all([
      api('/api/place'),
      api('/api/snapshot'),
      api('/api/fii'),
      api('/api/crypto'),
      api('/api/anual/estrutura'),
      api('/api/fixed-income'),
      api('/api/acao'),
    ]).then(([p, s, f, c, b, rf, ac]) => {
      setPlaces(p)
      setSnaps(s)
      setFiis(f)
      setCryptos(c)
      setPlano(b)
      setRendaFixa(rf)
      setAcoes(ac)
    }).catch(falhou)
    sincronizarPatrimonio()
      .then((atualizou) => {
        if (!atualizou) return
        return Promise.all([api('/api/place'), api('/api/snapshot')]).then(([p, s]) => {
          setPlaces(p)
          setSnaps(s)
        })
      })
      .catch(() => {})
  }, [api, falhou])

  // Cotação dos FIIs quando a lista chega.
  const tickers = useMemo(() => fiis.map((f) => f.ticker).join(','), [fiis])
  useEffect(() => {
    if (!tickers) return
    api(`/api/fii/quote?tickers=${tickers}`)
      .then((d) => setFiiQuotes(d.precos ?? {}))
      .catch(() => {}) // sem cotação: usa o preço médio
  }, [tickers, api])

  // Cotação das ações (mesma fonte do FII).
  const tickersAcoes = useMemo(() => acoes.map((a) => a.ticker).join(','), [acoes])
  useEffect(() => {
    if (!tickersAcoes) return
    api(`/api/acao/quote?tickers=${tickersAcoes}`)
      .then((d) => setAcaoQuotes(d.precos ?? {}))
      .catch(() => {})
  }, [tickersAcoes, api])

  // Lançamentos do mês selecionado.
  useEffect(() => {
    api(`/api/transaction?de=${mes}-01&ate=${fimDoMes(mes)}`).then(setTxs).catch(falhou)
  }, [mes, api, falhou])

  // ---- Cálculos ----
  const entradas = totalEntradas(txs, rates)
  const saidas = totalSaidas(txs, rates)
  const saldoMes = saldo(txs, rates)

  const moedaDoLugar = useMemo(
    () => Object.fromEntries(places.map((p) => [p.id, p.moeda])) as Record<string, Moeda>,
    [places],
  )
  const serie = useMemo(
    () => evolucaoBRL(snaps, moedaDoLugar, rates),
    [snaps, moedaDoLugar, rates],
  )
  const maxSerie = Math.max(1, ...serie.map((p) => p.total))
  const patAtual = serie.length ? serie[serie.length - 1].total : 0
  const patAnterior = serie.length > 1 ? serie[serie.length - 2].total : 0
  const patVar = variacaoPct(patAtual, patAnterior)
  const patMes = serie.length ? serie[serie.length - 1].mes.slice(0, 7) : mes

  const fii = fiiTotais(fiis, fiiQuotes)
  const acao = fiiTotais(acoes, acaoQuotes)
  const rf = rfTotais(rendaFixa)
  const cryptoAno = cryptos.filter((c) => c.ano === ANO_ATUAL)
  const cy = cryptoTotais(cryptoAno)

  // Metas do mês: quanto cada grupo do plano levou da receita do mês.
  const grupoDoItem = new Map(plano.itens.map((i) => [i.id, i.group_id]))
  const metas = plano.grupos
    .filter((g) => g.tipo !== 'receita')
    .map((g) => {
      const valor = txs
        .filter((t) => t.item_id && grupoDoItem.get(t.item_id) === g.id)
        .reduce((s, t) => s + valorEmBRL(t.valor, t.moeda, rates), 0)
      const pct = pctDaReceita(valor, entradas)
      const meta = g.meta_pct == null ? null : Number(g.meta_pct)
      return { g, valor, pct, meta, fora: metaFora(g.tipo, pct, meta) }
    })
    .filter((m) => m.valor > 0 || m.meta !== null)

  return (
    <PageLayout
      title="Visão geral"
      description="Resumo do mês e dos investimentos"
      icon={LayoutDashboard}
    >
      {erro && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Não deu pra carregar tudo: {erro}
        </p>
      )}
      {/* Patrimônio em destaque */}
      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={`Patrimônio (${rotuloMes(patMes)})`}
          value={formatBRL(patAtual)}
          icon={Landmark}
          highlight
          sub={
            patVar === null
              ? 'Sem mês anterior pra comparar'
              : `${patVar >= 0 ? 'Subiu' : 'Caiu'} ${Math.abs(patVar).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% vs mês anterior`
          }
        />
        <StatCard
          label="Ações (valor atual)"
          value={formatBRL(acao.atual)}
          icon={CandlestickChart}
          accent={acao.resultado >= 0 ? 'success' : 'destructive'}
          sub={`L/P ${acao.resultado >= 0 ? '+' : ''}${formatBRL(acao.resultado)}`}
        />
        <StatCard
          label="FIIs (valor atual)"
          value={formatBRL(fii.atual)}
          icon={Building2}
          accent={fii.resultado >= 0 ? 'success' : 'destructive'}
          sub={`L/P ${fii.resultado >= 0 ? '+' : ''}${formatBRL(fii.resultado)}`}
        />
        <StatCard
          label="Renda Fixa (valor atual)"
          value={formatBRL(rf.atual)}
          icon={Landmark}
          accent={rf.resultado >= 0 ? 'success' : 'destructive'}
          sub={`Rend. ${rf.resultado >= 0 ? '+' : ''}${formatBRL(rf.resultado)}`}
        />
        <StatCard
          label={`Cripto ${ANO_ATUAL} (L/P)`}
          value={formatBRL(cy.resultado * rates.USD)}
          icon={Bitcoin}
          accent={cy.resultado >= 0 ? 'success' : 'destructive'}
          sub={`Aplicado ≈ ${formatBRL(cy.aplicado * rates.USD)}`}
        />
      </div>

      {/* Mês de referência (lançamentos e metas) */}
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mês de referência</Label>
          <MonthPicker value={mes} onChange={setMes} />
        </div>
        <span className="ml-auto self-center text-xs text-muted-foreground">
          <ArrowLeftRight className="mr-1 inline h-3 w-3" />
          USD {formatBRL(rates.USD)} · EUR {formatBRL(rates.EUR)}
        </span>
      </div>

      {/* Fluxo do mês */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Entradas" value={formatBRL(entradas)} icon={ArrowUpRight} accent="success" />
        <StatCard label="Saídas" value={formatBRL(saidas)} icon={ArrowDownRight} accent="destructive" />
        <StatCard
          label="Saldo do mês"
          value={formatBRL(saldoMes)}
          icon={Scale}
          accent={saldoMes >= 0 ? 'success' : 'destructive'}
          highlight
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Evolução do patrimônio */}
        <Card className="p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp className="h-4 w-4" /> Evolução do patrimônio
          </div>
          {serie.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Registre o patrimônio de alguns meses pra ver aqui.
            </p>
          ) : (
            <div className="flex h-48 items-end gap-2">
              {serie.map((p, i) => (
                <div key={p.mes} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {(p.total / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k
                  </span>
                  <div
                    className={`w-full max-w-10 rounded-t-[4px] transition-colors ${i === serie.length - 1 ? 'bg-primary' : 'bg-primary/35 hover:bg-primary/60'}`}
                    style={{ height: `${Math.max(4, (p.total / maxSerie) * 150)}px` }}
                    title={formatBRL(p.total)}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {rotuloMes(p.mes.slice(0, 7)).slice(0, 3)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Metas do mês por grupo do plano */}
        <Card className="p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Target className="h-4 w-4" /> Metas de {rotuloMes(mes)} (% da receita)
          </div>
          {entradas === 0 || metas.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {entradas === 0
                ? 'Sem receita lançada nesse mês.'
                : 'Defina metas nos grupos do Controle Anual (editar grupo).'}
            </p>
          ) : (
            <ul className="space-y-3">
              {metas.map(({ g, valor, pct, meta, fora }) => (
                <li key={g.id} className="text-sm">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate">{g.name}</span>
                    <span className="shrink-0 tabular-nums">
                      <span className={fora ? 'font-semibold text-destructive' : 'font-medium'}>
                        {pct === null ? '—' : `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
                      </span>
                      <span className="text-muted-foreground"> · {formatBRL(valor)}</span>
                    </span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${fora ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${Math.min(100, pct ?? 0)}%` }}
                    />
                    {meta !== null && (
                      <div
                        className="absolute top-0 h-full w-0.5 bg-foreground/60"
                        style={{ left: `${Math.min(100, meta)}%` }}
                        title={`Meta: ${textoMeta(g.tipo, meta)}`}
                      />
                    )}
                  </div>
                  {meta !== null && <div className="mt-0.5 text-[11px] text-muted-foreground">Meta: {textoMeta(g.tipo, meta)}</div>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Atalhos */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-6">
        {[
          { to: '/fluxo', label: 'Lançamentos', icon: Wallet },
          { to: '/recorrencias', label: 'Recorrências', icon: Repeat },
          { to: '/patrimonio', label: 'Patrimônio', icon: TrendingUp },
          { to: '/acoes', label: 'Ações', icon: CandlestickChart },
          { to: '/fii', label: 'FIIs', icon: Building2 },
          { to: '/cripto', label: 'Cripto', icon: Bitcoin },
        ].map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            href={to}
            className="group flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-primary/30 hover:bg-accent"
          >
            <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
            {label}
          </Link>
        ))}
      </div>
    </PageLayout>
  )
}
