'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  TrendingUp,
  TrendingDown,
  Landmark,
  Plus,
  DollarSign,
  Euro,
  PiggyBank,
  Wallet,
  ChevronRight,
  Eye,
  EyeOff,
  ArrowLeftRight,
  CandlestickChart,
  Building2,
  Bitcoin,
  Handshake,
  type LucideIcon,
} from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MonthPicker } from '@/components/ui/month-picker'
import { usePromptDialog } from '@/components/ui/prompt'
import { rotuloMes, mesAnterior } from '@/lib/utils'
import { formatBRL } from '@/server/fluxo/fluxo.calc'
import {
  ORIGENS,
  ehAutomatico,
  emBRL,
  evolucaoBRL,
  mesAtualBR,
  visivelNoMes,
  variacaoPct,
  type Moeda,
  type Origem,
  type WealthPlace,
  type WealthSnapshot,
} from '@/server/patrimonio/patrimonio.calc'
import { LinhaBem, type StatusSalvar } from './LinhaBem'
import { sincronizarPatrimonio } from '@/lib/sincronizar'
import { useCotacao } from '@/lib/useRates'

// Ícone de cada investimento automático (a lista ORIGENS fica no servidor, sem UI).
const ICONE_ORIGEM: Record<Origem, LucideIcon> = {
  acao: CandlestickChart,
  fii: Building2,
  renda_fixa: Landmark,
  cripto: Bitcoin,
  consorcio: Handshake,
}


function fmtMoeda(v: number, moeda: Moeda) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: moeda })
}

export default function PatrimonioClient() {
  const router = useRouter()
  const ask = usePromptDialog()
  const [places, setPlaces] = useState<WealthPlace[]>([])
  const [snaps, setSnaps] = useState<WealthSnapshot[]>([])
  const [mes, setMes] = useState(mesAtualBR().slice(0, 7)) // horário de Brasília
  const [valores, setValores] = useState<Record<string, string>>({})
  const { rates, aoVivo: rateAoVivo } = useCotacao()
  const [erro, setErro] = useState<string | null>(null)
  const [status, setStatus] = useState<Record<string, StatusSalvar>>({})

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

  // Carrega JÁ o que está salvo; em paralelo atualiza a foto do mês atual
  // (investimentos + manuais herdados) e, se atualizou, recarrega.
  useEffect(() => {
    carregar()
    sincronizarPatrimonio()
      .then((atualizou) => {
        if (atualizou) return carregar()
      })
      .catch((e) => setErro(`Não deu pra atualizar os investimentos: ${(e as Error).message}`))
  }, [carregar])


  const mesData = `${mes}-01`
  // Campos com digitação ainda NÃO salva. Quando os dados recarregam (outra
  // linha salvou, a sincronização terminou), esses não são sobrescritos —
  // antes o valor em digitação sumia e, no blur, "nada mudou" e não salvava.
  const sujos = useRef(new Set<string>())
  const mesDosSujos = useRef(mesData)
  useEffect(() => {
    if (mesDosSujos.current !== mesData) {
      sujos.current.clear() // trocou de mês: descarta rascunhos do outro mês
      mesDosSujos.current = mesData
    }
    const m: Record<string, string> = {}
    for (const s of snaps) {
      if (s.mes.slice(0, 10) === mesData) m[s.place_id] = String(s.valor)
    }
    setValores((antes) => {
      for (const id of sujos.current) if (antes[id] !== undefined) m[id] = antes[id]
      return m
    })
  }, [snaps, mesData])

  // Valores já salvos no mês e no mês anterior (por lugar, moeda nativa).
  const valoresDoMes = useCallback(
    (alvo: string) => {
      const m = new Map<string, number>()
      for (const s of snaps) if (s.mes.slice(0, 10) === alvo) m.set(s.place_id, Number(s.valor))
      return m
    },
    [snaps],
  )
  const salvos = useMemo(() => valoresDoMes(mesData), [valoresDoMes, mesData])
  const anteriores = useMemo(
    () => valoresDoMes(`${mesAnterior(mes)}-01`),
    [valoresDoMes, mes],
  )

  function marcar(place_id: string, st: StatusSalvar | null) {
    setStatus((atual) => {
      const novo = { ...atual }
      if (st) novo[place_id] = st
      else delete novo[place_id]
      return novo
    })
  }

  async function salvar(place_id: string) {
    const valor = valores[place_id] ?? ''
    const salvo = salvos.get(place_id)
    // Nada mudou (ou campo vazio que nunca teve valor) -> não salva.
    if (valor === '' ? salvo === undefined : Number(valor) === salvo) {
      sujos.current.delete(place_id)
      return
    }
    setErro(null)
    marcar(place_id, 'salvando')
    try {
      await api('/api/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place_id, mes: mesData, valor: Number(valor) || 0 }),
      })
      sujos.current.delete(place_id)
      await carregar()
      marcar(place_id, 'salvo')
      // Some o "Salvo" depois de 2s (se não mudou de estado nesse meio-tempo).
      setTimeout(
        () =>
          setStatus((atual) => {
            if (atual[place_id] !== 'salvo') return atual
            const novo = { ...atual }
            delete novo[place_id]
            return novo
          }),
        2000,
      )
    } catch (e) {
      marcar(place_id, 'erro')
      setErro((e as Error).message)
    }
  }

  async function mudarMoeda(place_id: string, moeda: Moeda) {
    // O valor fica guardado na moeda do bem: trocar a moeda REINTERPRETA todo o
    // histórico (R$ 10.000 vira US$ 10.000). Confirma quando já há valores.
    if (
      snaps.some((s) => s.place_id === place_id) &&
      !confirm(
        `Trocar a moeda deste bem pra ${moeda}?\n\nOs valores já lançados (inclusive meses anteriores) passam a ser lidos em ${moeda}, sem conversão. Use só se a moeda estava errada desde o início.`,
      )
    )
      return
    try {
      await api(`/api/place/${place_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moeda }),
      })
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function ocultarLugar(place: WealthPlace, ocultar: boolean) {
    if (
      ocultar &&
      !confirm(
        `Ocultar "${place.name}" a partir de ${rotuloMes(mes)}?\n\n` +
          'Ele sai da lista e deixa de contar daqui pra frente. ' +
          'Os meses anteriores continuam no histórico. Dá pra mostrar de novo depois.',
      )
    )
      return
    setErro(null)
    try {
      await api(`/api/place/${place.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oculto_desde: ocultar ? mesData : null }),
      })
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function removerLugar(place: WealthPlace) {
    if (
      !confirm(
        `Remover "${place.name}" de vez?\n\n` +
          'Ele some do total e de TODO o histórico (gráficos e projeção). ' +
          'Se só não tem mais esse bem, use Ocultar: os meses anteriores continuam.',
      )
    )
      return
    setErro(null)
    try {
      await api(`/api/place/${place.id}`, { method: 'DELETE' })
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function novoLugar() {
    try {
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
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  // Investimentos (automáticos, na ordem dos módulos) x outros bens (manuais).
  const autos = useMemo(
    () =>
      ORIGENS.map((o) => places.find((p) => p.origem === o.origem)).filter(
        (p): p is WealthPlace => !!p,
      ),
    [places],
  )
  const todosManuais = useMemo(() => places.filter((p) => !ehAutomatico(p)), [places])
  const manuais = useMemo(
    () => todosManuais.filter((p) => visivelNoMes(p, mesData)),
    [todosManuais, mesData],
  )
  const ocultos = useMemo(
    () => todosManuais.filter((p) => !visivelNoMes(p, mesData)),
    [todosManuais, mesData],
  )
  const [verOcultos, setVerOcultos] = useState(false)
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

  // Somas na moeda nativa (pros cards secundários). Cripto é cotado em US$,
  // mas não é dinheiro em dólar: fica no card próprio.
  const emMoeda = useCallback((moeda: Moeda) => places.filter((p) => p.moeda === moeda && p.origem !== 'cripto'), [places])
  const somaNativa = useCallback(
    (lista: WealthPlace[]) => lista.reduce((s, p) => s + (Number(valores[p.id]) || 0), 0),
    [valores],
  )
  const totalUSD = somaNativa(emMoeda('USD'))
  const totalEUR = somaNativa(emMoeda('EUR'))
  const temUSD = emMoeda('USD').length > 0
  const temEUR = emMoeda('EUR').length > 0
  const lugarCripto = places.find((p) => p.origem === 'cripto')
  const totalCripto = lugarCripto ? Number(valores[lugarCripto.id]) || 0 : 0

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
          <ArrowLeftRight className="mr-1 inline h-3 w-3" />
          USD {formatBRL(rates.USD)} · EUR {formatBRL(rates.EUR)}{' '}
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
              ? `Antes: ${formatBRL(totalAnteriorBRL)}`
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
          sub="Ações, FIIs, Renda Fixa, Cripto e Consórcios"
        />
        <StatCard
          label="Outros bens (manual)"
          value={formatBRL(totalManualBRL)}
          icon={Wallet}
          sub={`${manuais.length} ${manuais.length === 1 ? 'item' : 'itens'}`}
        />
        {lugarCripto && totalCripto > 0 && (
          <StatCard
            label="Cripto"
            value={fmtMoeda(totalCripto, lugarCripto.moeda)}
            icon={Bitcoin}
            sub={`≈ ${formatBRL(emBRL(totalCripto, lugarCripto.moeda, rates))}`}
          />
        )}
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
                  className="group flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30"
                  title={`Editar em ${o.nome}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      {(() => {
                        const Icone = ICONE_ORIGEM[o.origem]
                        return <Icone className="h-[18px] w-[18px]" />
                      })()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block text-xs text-muted-foreground group-hover:text-primary">
                        Atualizado pelo módulo · editar
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="flex flex-col items-end">
                      <span className="text-base font-semibold tabular-nums">
                        {tem ? fmtMoeda(nativo, p.moeda) : '—'}
                      </span>
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
            <p className="px-4 pt-4 text-sm text-muted-foreground">
              Conta corrente, reserva, dinheiro em outra moeda… tudo que não é investimento.
            </p>
          )}
          <div className="divide-y divide-border">
            {manuais.map((p) => (
              <LinhaBem
                key={p.id}
                place={p}
                valor={valores[p.id] ?? ''}
                anterior={anteriores.get(p.id) ?? null}
                rates={rates}
                status={status[p.id]}
                onChange={(val) => {
                  sujos.current.add(p.id)
                  setValores((v) => ({ ...v, [p.id]: val }))
                }}
                onSave={() => salvar(p.id)}
                onMoeda={(m) => mudarMoeda(p.id, m)}
                onHide={() => ocultarLugar(p, true)}
                onRemove={() => removerLugar(p)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={novoLugar}
            className="flex w-full items-center justify-center gap-2 border-t border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-primary"
          >
            <Plus className="h-4 w-4" /> Adicionar bem
          </button>

          {/* Ocultos: fora da lista e do total a partir do mês, histórico mantido */}
          {ocultos.length > 0 && (
            <div className="border-t border-border bg-muted/20">
              <button
                type="button"
                onClick={() => setVerOcultos((v) => !v)}
                aria-expanded={verOcultos}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <EyeOff className="h-3.5 w-3.5" />
                {ocultos.length} {ocultos.length === 1 ? 'bem oculto' : 'bens ocultos'}
                <ChevronRight
                  className={`ml-auto h-3.5 w-3.5 transition-transform ${verOcultos ? 'rotate-90' : ''}`}
                />
              </button>
              {verOcultos && (
                <div className="divide-y divide-border">
                  {ocultos.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-muted-foreground">
                          {p.name}
                        </div>
                        <div className="text-xs text-muted-foreground/80">
                          Oculto desde {rotuloMes(String(p.oculto_desde).slice(0, 7))} · histórico
                          anterior mantido
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => ocultarLugar(p, false)}
                        title="Volta a aparecer e contar em todos os meses"
                      >
                        <Eye /> Mostrar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3 font-semibold">
            <span>Total (em real)</span>
            <span className="tabular-nums text-primary">{formatBRL(totalBRL)}</span>
          </div>
        </Card>

        {/* Evolução (gráfico de barras CSS) */}
        <Card className="p-4">
          <div className="mb-4 text-sm font-medium text-muted-foreground">
            Evolução do patrimônio (em real)
          </div>
          {serie.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Preencha os valores de alguns meses pra ver a evolução.
            </p>
          ) : (
            <div className="flex h-56 items-end gap-2">
              {serie.map((ponto, i) => (
                <div key={ponto.mes} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {(ponto.total / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k
                  </span>
                  <div
                    className={`w-full max-w-10 rounded-t-[4px] transition-colors ${i === serie.length - 1 ? 'bg-primary' : 'bg-primary/35 hover:bg-primary/60'}`}
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
