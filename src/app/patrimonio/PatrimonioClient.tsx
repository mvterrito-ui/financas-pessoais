'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  TrendingUp,
  TrendingDown,
  Landmark,
  Plus,
  DollarSign,
  Euro,
  Trash2,
  PiggyBank,
  Wallet,
  ChevronRight,
} from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MoneyInput } from '@/components/ui/money-input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { MonthPicker } from '@/components/ui/month-picker'
import { usePromptDialog } from '@/components/ui/prompt'
import { hojeISO, rotuloMes, mesAnterior } from '@/lib/utils'
import { formatBRL } from '@/server/fluxo/fluxo.calc'
import {
  ORIGENS,
  ehAutomatico,
  emBRL,
  evolucaoBRL,
  variacaoPct,
  type Moeda,
  type Rates,
  type WealthPlace,
  type WealthSnapshot,
} from '@/server/patrimonio/patrimonio.calc'

const FALLBACK: Rates = { USD: 5.4, EUR: 5.9 }

function fmtMoeda(v: number, moeda: Moeda) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: moeda })
}

export default function PatrimonioClient() {
  const router = useRouter()
  const ask = usePromptDialog()
  const [places, setPlaces] = useState<WealthPlace[]>([])
  const [snaps, setSnaps] = useState<WealthSnapshot[]>([])
  const [mes, setMes] = useState(hojeISO().slice(0, 7))
  const [valores, setValores] = useState<Record<string, string>>({})
  const [rates, setRates] = useState<Rates>(FALLBACK)
  const [rateAoVivo, setRateAoVivo] = useState(false)
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
      const [p, s] = await Promise.all([api('/api/place'), api('/api/snapshot')])
      setPlaces(p)
      setSnaps(s)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [api])

  // 1º atualiza a foto do MÊS ATUAL dos investimentos (Ações, FIIs, Renda
  // Fixa, Cripto) com o valor de hoje; depois carrega tudo.
  useEffect(() => {
    api('/api/patrimonio/sincronizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes: `${hojeISO().slice(0, 7)}-01` }),
    })
      .catch((e) => setErro(`Não deu pra atualizar os investimentos: ${(e as Error).message}`))
      .finally(carregar)
  }, [api, carregar])

  // Cotação ao vivo (USD-BRL e EUR-BRL). Se falhar, usa o fallback.
  useEffect(() => {
    fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL')
      .then((r) => r.json())
      .then((d) => {
        setRates({ USD: Number(d.USDBRL.bid), EUR: Number(d.EURBRL.bid) })
        setRateAoVivo(true)
      })
      .catch(() => setRateAoVivo(false))
  }, [])

  const mesData = `${mes}-01`
  useEffect(() => {
    const m: Record<string, string> = {}
    for (const s of snaps) {
      if (s.mes.slice(0, 10) === mesData) m[s.place_id] = String(s.valor)
    }
    setValores(m)
  }, [snaps, mesData])

  async function salvar(place_id: string, valor: string) {
    setErro(null)
    try {
      await api('/api/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place_id, mes: mesData, valor: Number(valor) || 0 }),
      })
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function mudarMoeda(place_id: string, moeda: Moeda) {
    await api(`/api/place/${place_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moeda }),
    })
    await carregar()
  }

  async function removerLugar(place: WealthPlace) {
    if (!confirm(`Remover "${place.name}" do patrimônio? Ele some do total e da evolução.`)) return
    setErro(null)
    try {
      await api(`/api/place/${place.id}`, { method: 'DELETE' })
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function novoLugar() {
    const v = await ask({
      title: 'Novo bem (manual)',
      fields: [{ name: 'name', label: 'Nome', placeholder: 'Conta corrente, Reserva, Imóvel...' }],
    })
    if (!v?.name) return
    await api('/api/place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: v.name, ordem: places.length + 1 }),
    })
    await carregar()
  }

  // Investimentos (automáticos, na ordem dos módulos) x outros bens (manuais).
  const autos = useMemo(
    () =>
      ORIGENS.map((o) => places.find((p) => p.origem === o.origem)).filter(
        (p): p is WealthPlace => !!p,
      ),
    [places],
  )
  const manuais = useMemo(() => places.filter((p) => !ehAutomatico(p)), [places])
  const somaBRL = useCallback(
    (lista: WealthPlace[]) =>
      lista.reduce((s, p) => s + emBRL(Number(valores[p.id]) || 0, p.moeda, rates), 0),
    [valores, rates],
  )
  const totalInvestBRL = somaBRL(autos)
  const totalManualBRL = somaBRL(manuais)

  const moedaDoLugar = useMemo(
    () => Object.fromEntries(places.map((p) => [p.id, p.moeda])) as Record<string, Moeda>,
    [places],
  )

  // Total do mês em REAL (converte cada lugar pela sua moeda).
  const totalBRL = useMemo(
    () =>
      places.reduce(
        (s, p) => s + emBRL(Number(valores[p.id]) || 0, p.moeda, rates),
        0,
      ),
    [places, valores, rates],
  )

  // Somas na moeda nativa (pros cards secundários).
  const totalPorMoeda = useCallback(
    (moeda: Moeda) =>
      places
        .filter((p) => p.moeda === moeda)
        .reduce((s, p) => s + (Number(valores[p.id]) || 0), 0),
    [places, valores],
  )
  const totalUSD = totalPorMoeda('USD')
  const totalEUR = totalPorMoeda('EUR')
  const temUSD = places.some((p) => p.moeda === 'USD')
  const temEUR = places.some((p) => p.moeda === 'EUR')

  // Mês anterior em real (dos dados salvos).
  const totalAnteriorBRL = useMemo(() => {
    const alvo = `${mesAnterior(mes)}-01`
    return snaps
      .filter((s) => s.mes.slice(0, 10) === alvo)
      .reduce((s, x) => s + emBRL(Number(x.valor), moedaDoLugar[x.place_id] ?? 'BRL', rates), 0)
  }, [snaps, mes, moedaDoLugar, rates])

  const variacao = variacaoPct(totalBRL, totalAnteriorBRL)
  const serie = useMemo(
    () => evolucaoBRL(snaps, moedaDoLugar, rates),
    [snaps, moedaDoLugar, rates],
  )
  const maxSerie = Math.max(1, ...serie.map((p) => p.total))

  return (
    <PageLayout
      title="Patrimônio"
      description="Quanto você tem, mês a mês (total em real)"
      icon={TrendingUp}
      actions={
        <Button onClick={novoLugar}>
          <Plus /> Novo bem
        </Button>
      }
    >
      {/* Mês + cotação */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mês</Label>
          <MonthPicker value={mes} onChange={setMes} />
        </div>
        <span className="ml-auto self-center text-xs text-muted-foreground">
          💱 USD {formatBRL(rates.USD)} · EUR {formatBRL(rates.EUR)}{' '}
          {rateAoVivo ? '(ao vivo)' : '(estimado)'}
        </span>
      </div>

      {/* KPI principal: total em real */}
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <StatCard
          label={`Patrimônio em ${rotuloMes(mes)} (em real)`}
          value={formatBRL(totalBRL)}
          icon={Landmark}
          accent="primary"
          highlight
        />
        <StatCard
          label="Variação vs mês anterior"
          value={
            variacao === null
              ? '—'
              : `${variacao >= 0 ? '+' : ''}${variacao.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
          }
          icon={variacao !== null && variacao < 0 ? TrendingDown : TrendingUp}
          accent={variacao === null ? 'default' : variacao >= 0 ? 'success' : 'destructive'}
          sub={
            totalAnteriorBRL
              ? `${formatBRL(totalAnteriorBRL)} → ${formatBRL(totalBRL)}`
              : 'Sem mês anterior pra comparar'
          }
        />
      </div>

      {/* Composição: investimentos x outros bens; e moeda estrangeira */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Investimentos"
          value={formatBRL(totalInvestBRL)}
          icon={PiggyBank}
          sub="Ações, FIIs, Renda Fixa e Cripto"
        />
        <StatCard
          label="Outros bens (manual)"
          value={formatBRL(totalManualBRL)}
          icon={Wallet}
          sub={`${manuais.length} ${manuais.length === 1 ? 'item' : 'itens'}`}
        />
        {temUSD && (
          <StatCard
            label="Em dólar"
            value={fmtMoeda(totalUSD, 'USD')}
            icon={DollarSign}
            sub={`≈ ${formatBRL(totalUSD * rates.USD)}`}
          />
        )}
        {temEUR && (
          <StatCard
            label="Em euro"
            value={fmtMoeda(totalEUR, 'EUR')}
            icon={Euro}
            sub={`≈ ${formatBRL(totalEUR * rates.EUR)}`}
          />
        )}
      </div>

      {erro && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Valores por lugar */}
        <Card className="overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground">
            Valores em {rotuloMes(mes)}
          </div>
          {/* Investimentos: valor vem dos módulos (só leitura) */}
          <SecaoTitulo titulo="Investimentos" detalhe="automático" total={totalInvestBRL} />
          <div className="divide-y divide-border">
            {autos.map((p) => {
              const o = ORIGENS.find((x) => x.origem === p.origem)!
              const tem = valores[p.id] !== undefined
              const nativo = Number(valores[p.id]) || 0
              return (
                <Link
                  key={p.id}
                  href={o.href}
                  className="flex items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-accent/50"
                  title={`Editar em ${o.nome}`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <span>{o.emoji}</span> {p.name}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="flex flex-col items-end">
                      <span className="tabular-nums">{tem ? fmtMoeda(nativo, p.moeda) : '—'}</span>
                      {p.moeda !== 'BRL' && nativo > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          ≈ {formatBRL(emBRL(nativo, p.moeda, rates))}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </span>
                </Link>
              )
            })}
          </div>

          {/* Outros bens: digitados à mão */}
          <SecaoTitulo titulo="Outros bens" detalhe="manual" total={totalManualBRL} />
          {manuais.length === 0 && (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              Nada aqui ainda. Use <strong>Novo bem</strong> pra adicionar conta corrente, reserva,
              dinheiro em outra moeda...
            </p>
          )}
          <div className="divide-y divide-border">
            {manuais.map((p) => {              const nativo = Number(valores[p.id]) || 0
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <span className="w-20 shrink-0 font-medium">{p.name}</span>
                  <Select
                    className="h-9 w-20"
                    value={p.moeda}
                    onChange={(e) => mudarMoeda(p.id, e.target.value as Moeda)}
                  >
                    <option value="BRL">R$</option>
                    <option value="USD">US$</option>
                    <option value="EUR">€</option>
                  </Select>
                  <div className="flex flex-1 flex-col items-end">
                    <MoneyInput
                      placeholder="0,00"
                      className="h-9 w-36 text-right tabular-nums"
                      value={valores[p.id] ?? ''}
                      onValueChange={(val) => setValores((v) => ({ ...v, [p.id]: val }))}
                      onBlur={() => salvar(p.id, valores[p.id] ?? '')}
                    />
                    {p.moeda !== 'BRL' && nativo > 0 && (
                      <span className="mt-0.5 text-[10px] text-muted-foreground">
                        ≈ {formatBRL(emBRL(nativo, p.moeda, rates))}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    title={`Remover ${p.name}`}
                    aria-label={`Remover ${p.name}`}
                    onClick={() => removerLugar(p)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3 font-semibold">
            <span>Total (em real)</span>
            <span className="tabular-nums text-primary">{formatBRL(totalBRL)}</span>
          </div>
        </Card>

        {/* Evolução (gráfico de barras CSS) */}
        <Card className="p-4">
          <div className="mb-4 text-sm font-medium text-muted-foreground">
            📈 Evolução do patrimônio (em real)
          </div>
          {serie.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Preencha os valores de alguns meses pra ver a evolução.
            </p>
          ) : (
            <div className="flex h-56 items-end gap-2">
              {serie.map((ponto) => (
                <div key={ponto.mes} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {(ponto.total / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k
                  </span>
                  <div
                    className="w-full rounded-t bg-primary/80 transition-all hover:bg-primary"
                    style={{ height: `${Math.max(4, (ponto.total / maxSerie) * 180)}px` }}
                    title={formatBRL(ponto.total)}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {rotuloMes(ponto.mes.slice(0, 7)).slice(0, 3)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageLayout>
  )
}

function SecaoTitulo({ titulo, detalhe, total }: { titulo: string; detalhe: string; total: number }) {
  return (
    <div className="flex items-center justify-between border-y border-border bg-muted/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <span>
        {titulo} <span className="font-normal normal-case">· {detalhe}</span>
      </span>
      <span className="tabular-nums normal-case">{formatBRL(total)}</span>
    </div>
  )
}
