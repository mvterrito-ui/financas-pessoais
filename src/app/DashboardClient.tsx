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
  TrendingDown,
  Building2,
  Bitcoin,
  Landmark,
  PieChart,
} from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { hojeISO, fimDoMes, rotuloMes, mesAnterior } from '@/lib/utils'
import {
  formatBRL,
  saldo,
  totalEntradas,
  totalSaidas,
  type Transaction,
} from '@/server/fluxo/fluxo.calc'
import {
  emBRL,
  evolucaoBRL,
  variacaoPct,
  type Moeda,
  type Rates,
  type WealthPlace,
  type WealthSnapshot,
} from '@/server/patrimonio/patrimonio.calc'
import { totais as fiiTotais, type Fii, type Quotes } from '@/server/fii/fii.calc'
import { totais as rfTotais, type FixedIncome } from '@/server/renda-fixa/renda-fixa.calc'
import { totais as cryptoTotais, type CryptoSummary } from '@/server/cripto/cripto.calc'
import { alocar, type BudgetBucket } from '@/server/orcamento/orcamento.calc'

const FALLBACK: Rates = { USD: 5.4, EUR: 5.9 }
const ANO_ATUAL = Number(hojeISO().slice(0, 4))

export default function DashboardClient() {
  const router = useRouter()
  const [mes, setMes] = useState(hojeISO().slice(0, 7))
  const [rates, setRates] = useState<Rates>(FALLBACK)

  const [txs, setTxs] = useState<Transaction[]>([])
  const [places, setPlaces] = useState<WealthPlace[]>([])
  const [snaps, setSnaps] = useState<WealthSnapshot[]>([])
  const [fiis, setFiis] = useState<Fii[]>([])
  const [fiiQuotes, setFiiQuotes] = useState<Quotes>({})
  const [rendaFixa, setRendaFixa] = useState<FixedIncome[]>([])
  const [cryptos, setCryptos] = useState<CryptoSummary[]>([])
  const [buckets, setBuckets] = useState<BudgetBucket[]>([])

  const api = useCallback(
    async (url: string) => {
      const res = await fetch(url)
      if (res.status === 401) {
        router.push('/login')
        throw new Error('Sessão expirada')
      }
      return res.json()
    },
    [router],
  )

  // Carrega tudo (uma vez) e a cotação.
  useEffect(() => {
    Promise.all([
      api('/api/place'),
      api('/api/snapshot'),
      api('/api/fii'),
      api('/api/crypto'),
      api('/api/budget'),
      api('/api/fixed-income'),
    ]).then(([p, s, f, c, b, rf]) => {
      setPlaces(p)
      setSnaps(s)
      setFiis(f)
      setCryptos(c)
      setBuckets(b)
      setRendaFixa(rf)
    })
    fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL')
      .then((r) => r.json())
      .then((d) => setRates({ USD: Number(d.USDBRL.bid), EUR: Number(d.EURBRL.bid) }))
      .catch(() => {})
  }, [api])

  // Cotação dos FIIs quando a lista chega.
  const tickers = useMemo(() => fiis.map((f) => f.ticker).join(','), [fiis])
  useEffect(() => {
    if (!tickers) return
    api(`/api/fii/quote?tickers=${tickers}`).then((d) => setFiiQuotes(d.precos ?? {}))
  }, [tickers, api])

  // Lançamentos do mês selecionado.
  useEffect(() => {
    api(`/api/transaction?de=${mes}-01&ate=${fimDoMes(mes)}`).then(setTxs)
  }, [mes, api])

  // ---- Cálculos ----
  const entradas = totalEntradas(txs)
  const saidas = totalSaidas(txs)
  const saldoMes = saldo(txs)

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
  const rf = rfTotais(rendaFixa)
  const cryptoAno = cryptos.filter((c) => c.ano === ANO_ATUAL)
  const cy = cryptoTotais(cryptoAno)

  const rendaMes = entradas
  const alocacoes = alocar(rendaMes, buckets)

  return (
    <PageLayout
      title="Visão geral"
      description="Seu panorama financeiro num lugar só"
      icon={LayoutDashboard}
    >
      {/* Patrimônio em destaque */}
      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-primary p-5 text-primary-foreground md:col-span-1">
          <p className="text-sm opacity-80">Patrimônio ({rotuloMes(patMes)})</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{formatBRL(patAtual)}</p>
          {patVar !== null && (
            <p className="mt-1 text-sm opacity-90">
              {patVar >= 0 ? '▲' : '▼'} {Math.abs(patVar).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% vs mês anterior
            </p>
          )}
        </Card>
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

      {/* Mês de referência (Fluxo + Orçamento) */}
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mês de referência</Label>
          <Input type="month" className="w-44" value={mes} onChange={(e) => setMes(e.target.value)} />
        </div>
        <span className="ml-auto self-center text-xs text-muted-foreground">
          💱 USD {formatBRL(rates.USD)} · EUR {formatBRL(rates.EUR)}
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
              {serie.map((p) => (
                <div key={p.mes} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {(p.total / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k
                  </span>
                  <div
                    className="w-full rounded-t bg-primary/80"
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

        {/* Alocação da renda (orçamento) */}
        <Card className="p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <PieChart className="h-4 w-4" /> Divisão da renda de {rotuloMes(mes)}
          </div>
          {rendaMes === 0 || buckets.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Sem renda lançada nesse mês (ou sem baldes).
            </p>
          ) : (
            <div className="space-y-2">
              {alocacoes.map((b) => (
                <div key={b.id} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 truncate">{b.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${b.percentual}%` }} />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                    {Number(b.percentual)}%
                  </span>
                  <span className="w-24 shrink-0 text-right font-medium tabular-nums">
                    {formatBRL(b.valor)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Atalhos */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { to: '/fluxo', label: 'Fluxo', emoji: '💸' },
          { to: '/orcamento', label: 'Orçamento', emoji: '🎯' },
          { to: '/patrimonio', label: 'Patrimônio', emoji: '📈' },
          { to: '/fii', label: 'FIIs', emoji: '🏢' },
          { to: '/cripto', label: 'Cripto', emoji: '🪙' },
        ].map((a) => (
          <Link
            key={a.to}
            href={a.to}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            <span className="text-lg">{a.emoji}</span> {a.label}
          </Link>
        ))}
      </div>
    </PageLayout>
  )
}
