'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  TrendingUp,
  PiggyBank,
  Wallet,
  RotateCcw,
  Check,
  TriangleAlert,
} from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { useCotacao } from '@/lib/useRates'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MoneyInput } from '@/components/ui/money-input'
import { NumberField } from '@/components/ui/number-field'
import { Label } from '@/components/ui/label'
import { formatBRL } from '@/server/fluxo/fluxo.calc'
import {
  emBRL,
  evolucaoBRL,
  type Moeda,
  type WealthPlace,
  type WealthSnapshot,
} from '@/server/patrimonio/patrimonio.calc'
import {
  taxaMensalComparavel,
  mensalParaAnual,
  projetar,
} from '@/server/patrimonio/projecao.calc'

const HORIZONTES = [1, 3, 5, 10, 15, 20] as const

export default function ProjecaoClient() {
  const router = useRouter()
  const [places, setPlaces] = useState<WealthPlace[]>([])
  const [snaps, setSnaps] = useState<WealthSnapshot[]>([])
  const { rates } = useCotacao()
  const [erro, setErro] = useState<string | null>(null)

  // controles
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [anos, setAnos] = useState<number>(5)
  const [aporte, setAporte] = useState('0')
  const [taxaManual, setTaxaManual] = useState(false)
  const [taxaInput, setTaxaInput] = useState('')

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

  useEffect(() => {
    Promise.all([api('/api/place'), api('/api/snapshot')])
      .then(([p, s]) => {
        setPlaces(p)
        setSnaps(s)
        setSelecionados(new Set((p as WealthPlace[]).map((x) => x.id))) // começa com todos
      })
      .catch((e) => setErro((e as Error).message))
  }, [api])


  const moedaDoLugar = useMemo(
    () => Object.fromEntries(places.map((p) => [p.id, p.moeda])) as Record<string, Moeda>,
    [places],
  )

  function toggle(id: string) {
    setSelecionados((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  // Série histórica SÓ dos lugares selecionados, já em real e somada por mês.
  const serie = useMemo(() => {
    const filtrados = snaps.filter((s) => selecionados.has(s.place_id))
    return evolucaoBRL(filtrados, moedaDoLugar, rates)
  }, [snaps, selecionados, moedaDoLugar, rates])

  // Taxa MENSAL do histórico ("igual com igual": bem novo não vira rendimento)
  // e taxa em uso (% ao mês, ajustável na mão).
  const taxaHist = useMemo(
    () =>
      taxaMensalComparavel(
        snaps
          .filter((s) => selecionados.has(s.place_id))
          .map((s) => ({
            mes: s.mes,
            place_id: s.place_id,
            valor: emBRL(Number(s.valor), moedaDoLugar[s.place_id] ?? 'BRL', rates),
          })),
      ),
    [snaps, selecionados, moedaDoLugar, rates],
  )
  const taxaAuto = taxaHist === null ? null : taxaHist * 100 // % ao mês
  const taxaPct = taxaManual ? Number(taxaInput) || 0 : taxaAuto ?? 0 // % ao mês
  const anualEquivalente = mensalParaAnual(taxaPct / 100) * 100 // só pra exibir

  const valorInicial = serie.length ? serie[serie.length - 1].total : 0
  const projecao = useMemo(
    () => projetar(valorInicial, taxaPct / 100, Number(aporte) || 0, anos),
    [valorInicial, taxaPct, aporte, anos],
  )

  const final = projecao[projecao.length - 1]
  const rendimento = final.valor - valorInicial - final.aportado // só os juros
  const maxBar = Math.max(1, ...projecao.map((p) => p.valor))

  const semHistorico = serie.length < 2 || taxaHist === null

  return (
    <PageLayout
      title="Projeção inteligente"
      description="Até onde o patrimônio pode chegar, com base no histórico"
      icon={Sparkles}
    >
      {erro && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      {places.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          titulo="Sem patrimônio pra projetar ainda"
          descricao="Preencha alguns meses no Patrimônio que a projeção aparece aqui."
        />
      ) : (
        <>
          {/* Controles */}
          <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            {/* Filtro de lugares */}
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Incluir na projeção
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setSelecionados(new Set(places.map((p) => p.id)))}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:underline"
                    onClick={() => setSelecionados(new Set())}
                  >
                    Limpar
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {places.map((p) => {
                  const on = selecionados.has(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        on
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {on && <Check className="mr-1 inline h-3.5 w-3.5" />}
                      {p.name}
                      {p.moeda !== 'BRL' && (
                        <span className="ml-1 text-[10px] opacity-60">{p.moeda}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </Card>

            {/* Taxa + aporte + horizonte */}
            <Card className="grid gap-4 p-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="taxa">Rendimento ao mês (%)</Label>
                <div className="flex items-center gap-2">
                  <NumberField
                    id="taxa"
                    sufixo="% a.m."
                    className="w-36"
                    value={taxaManual ? taxaInput : taxaAuto?.toFixed(2) ?? ''}
                    placeholder={taxaAuto?.toFixed(2).replace('.', ',') ?? '1,00'}
                    onValueChange={(v) => {
                      setTaxaInput(v)
                      setTaxaManual(true)
                    }}
                  />
                  {taxaManual && taxaAuto !== null && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setTaxaManual(false)
                        setTaxaInput('')
                      }}
                    >
                      <RotateCcw /> Histórico
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  ≈ {anualEquivalente.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% ao ano
                  {taxaAuto !== null &&
                    ` · histórico: ${taxaAuto.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%/mês`}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="aporte">Aporte mensal (R$)</Label>
                <MoneyInput
                  id="aporte"
                  prefixo="R$"
                  className="w-44"
                  value={aporte}
                  onValueChange={setAporte}
                />
                <p className="text-xs text-muted-foreground">Quanto você guarda por mês.</p>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Horizonte</Label>
                <div className="flex gap-2">
                  {HORIZONTES.map((h) => (
                    <Button
                      key={h}
                      type="button"
                      size="sm"
                      variant={anos === h ? 'default' : 'outline'}
                      onClick={() => setAnos(h)}
                    >
                      {h} {h === 1 ? 'ano' : 'anos'}
                    </Button>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {semHistorico && (
            <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                São necessários pelo menos 2 meses com valor pra calcular a taxa automática. Até lá,
                ajuste o % manualmente acima.
              </span>
            </p>
          )}

          {/* KPIs */}
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Hoje (seleção)"
              value={formatBRL(valorInicial)}
              icon={Wallet}
            />
            <StatCard
              label={`Em ${anos} ${anos === 1 ? 'ano' : 'anos'}`}
              value={formatBRL(final.valor)}
              icon={TrendingUp}
              accent="primary"
              highlight
              sub={`${final.aportado > 0 ? formatBRL(final.aportado) + ' aportados · ' : ''}${formatBRL(rendimento)} de rendimento`}
            />
            <StatCard
              label="Só os juros no período"
              value={formatBRL(rendimento)}
              icon={PiggyBank}
              accent="success"
              sub="O que o dinheiro rendeu sozinho"
            />
          </div>

          {/* Gráfico de projeção (barras por ano) */}
          <Card className="p-4">
            <div className="mb-4 text-sm font-medium text-muted-foreground">
              Projeção ano a ano {final.aportado > 0 && '(barra cheia = total; faixa clara = aportes)'}
            </div>
            <div className="flex h-60 items-end gap-2">
              {projecao.map((p) => {
                const alturaTotal = Math.max(4, (p.valor / maxBar) * 200)
                const fracAporte = p.valor > 0 ? (p.aportado / p.valor) * alturaTotal : 0
                return (
                  <div key={p.ano} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {(p.valor / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k
                    </span>
                    <div
                      className="relative w-full overflow-hidden rounded-t bg-primary/80 transition-all hover:bg-primary"
                      style={{ height: `${alturaTotal}px` }}
                      title={`Ano ${p.ano}: ${formatBRL(p.valor)}`}
                    >
                      {/* faixa dos aportes (base da barra) */}
                      <div
                        className="absolute bottom-0 left-0 w-full bg-white/35"
                        style={{ height: `${fracAporte}px` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {p.ano === 0 ? 'hoje' : `${p.ano}a`}
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}
    </PageLayout>
  )
}
