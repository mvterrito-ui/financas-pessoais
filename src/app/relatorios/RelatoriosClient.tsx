'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownRight, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, PiggyBank, Scale, X } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { nomeCategoria, type Plano } from '@/components/shared/CategoriaSelect'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn, formatData } from '@/lib/utils'
import { useCotacao } from '@/lib/useRates'
import { formatBRL, porCategoria, valorEmBRL, type Moeda, type Transaction } from '@/server/fluxo/fluxo.calc'
import { OUTROS, SEM_GRUPO, porMes, saidasPorGrupoMes, topoDoEixo } from '@/server/fluxo/relatorio.calc'
import { MESES_CURTOS } from '../anual/tipos'

const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
// Cores das séries em globals.css (validadas nos dois temas). Entradas = 1, saídas = 2.
const CORES_GRUPOS = ['var(--serie-1)', 'var(--serie-2)', 'var(--serie-3)', 'var(--serie-4)', 'var(--serie-5)']
const COR_OUTROS = 'var(--serie-outros)'

const fmtPct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
// Rótulo curto pro eixo: "R$ 2,5 mil".
const fmtEixo = (v: number) =>
  Math.abs(v) >= 1000
    ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
    : `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`

// ---------------------------------------------------------------- peças

function Legenda({ itens }: { itens: { cor: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {itens.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: i.cor }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

function CabecalhoGrafico({ titulo, sub, children }: { titulo: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-sm font-medium">{titulo}</h2>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

// Linhas de grade com rótulos (0, metade e topo). Ficam atrás das barras.
function Grade({ topo, base = 0 }: { topo: number; base?: number }) {
  const linhas = base < 0 ? [topo, 0, base] : [topo, topo / 2, 0]
  const faixa = topo - base
  return (
    <div className="pointer-events-none absolute inset-0">
      {linhas.map((v) => (
        <div
          key={v}
          className={cn('absolute inset-x-0 border-t', v === 0 ? 'border-border' : 'border-dashed border-border/60')}
          style={{ top: `${((topo - v) / faixa) * 100}%` }}
        >
          <span className="absolute -top-2 left-0 -translate-x-full pr-2 text-[10px] tabular-nums text-muted-foreground">
            {fmtEixo(v)}
          </span>
        </div>
      ))}
    </div>
  )
}

function Tooltip({ i, children }: { i: number; children: ReactNode }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute bottom-full z-20 mb-2 hidden w-52 rounded-lg border border-border bg-card p-2.5 text-xs shadow-lg group-hover:block group-focus-visible:block',
        i > 8 ? 'right-0' : i < 3 ? 'left-0' : 'left-1/2 -translate-x-1/2',
      )}
    >
      {children}
    </div>
  )
}

function LinhaTooltip({ cor, label, valor, forte }: { cor?: string; label: string; valor: string; forte?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-3', forte && 'mt-1 border-t border-border pt-1 font-medium')}>
      <span className={cn('flex min-w-0 items-center gap-1.5', !forte && 'text-muted-foreground')}>
        {cor && <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: cor }} />}
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 tabular-nums">{valor}</span>
    </div>
  )
}

function EixoMeses({ mesSel }: { mesSel: number | null }) {
  return (
    <div className="mt-1.5 flex gap-1 sm:gap-2">
      {MESES_CURTOS.map((m, i) => (
        <span
          key={m}
          className={cn(
            'flex-1 text-center text-[10px]',
            mesSel === i ? 'font-semibold text-foreground' : 'text-muted-foreground',
          )}
        >
          {m}
        </span>
      ))}
    </div>
  )
}

// Barras horizontais ordenadas: nome, barra e valor na mesma linha.
function Ranking({
  linhas,
  vazio,
}: {
  linhas: { id: string; nome: string; valor: number; pct: number; cor: string }[]
  vazio: string
}) {
  if (linhas.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{vazio}</p>
  const max = Math.max(1, ...linhas.map((l) => l.valor))
  return (
    <ul className="space-y-2.5">
      {linhas.map((l) => (
        <li key={l.id} className="grid grid-cols-[minmax(0,8rem)_1fr] items-center gap-3 text-sm sm:grid-cols-[minmax(0,11rem)_1fr]">
          <span className="truncate" title={l.nome}>
            {l.nome}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 min-w-0 flex-1 rounded-full bg-muted">
              <span className="block h-full rounded-full" style={{ width: `${(l.valor / max) * 100}%`, background: l.cor }} />
            </span>
            <span className="w-32 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              <span className="font-medium text-foreground">{formatBRL(l.valor)}</span> · {fmtPct(l.pct)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------- tela

export default function RelatoriosClient() {
  const router = useRouter()
  const { rates } = useCotacao()
  const [ano, setAno] = useState(() => new Date().getFullYear())
  const [mesSel, setMesSel] = useState<number | null>(null)
  const [txs, setTxs] = useState<Transaction[]>([])
  const [plano, setPlano] = useState<Plano>({ grupos: [], categorias: [], itens: [] })
  const [carregado, setCarregado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

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
    let vivo = true
    api('/api/anual/estrutura')
      .then((pl) => vivo && setPlano(pl))
      .catch((e) => vivo && setErro((e as Error).message))
    return () => {
      vivo = false
    }
  }, [api])

  useEffect(() => {
    let vivo = true
    api(`/api/transaction?de=${ano}-01-01&ate=${ano}-12-31`)
      .then((t) => vivo && setTxs(t))
      .catch((e) => vivo && setErro((e as Error).message))
      .finally(() => vivo && setCarregado(true))
    return () => {
      vivo = false
    }
  }, [api, ano])

  function mudarAno(delta: number) {
    setAno((a) => a + delta)
    setMesSel(null)
  }
  const alternarMes = (i: number) => setMesSel((m) => (m === i ? null : i))

  const emReal = useCallback(
    (v: number | string, m?: string | null) => valorEmBRL(v, (m ?? 'BRL') as Moeda, rates),
    [rates],
  )

  // ---- ano inteiro (gráficos mês a mês)
  const meses = useMemo(() => porMes(txs, emReal), [txs, emReal])
  const grupoDoItem = useMemo(() => new Map(plano.itens.map((i) => [i.id, i.group_id])), [plano])
  const nomeGrupo = useCallback(
    (id: string) =>
      id === SEM_GRUPO ? 'Sem categoria' : id === OUTROS ? 'Outros' : (plano.grupos.find((g) => g.id === id)?.name ?? 'Grupo removido'),
    [plano],
  )
  const grupos = useMemo(() => saidasPorGrupoMes(txs, grupoDoItem, emReal), [txs, grupoDoItem, emReal])
  // Cor fixa por grupo (ordem do ano): não muda ao escolher um mês.
  const corDoGrupo = useMemo(() => {
    const m = new Map<string, string>()
    grupos.forEach((g, i) => m.set(g.id, g.id === OUTROS ? COR_OUTROS : CORES_GRUPOS[i]))
    return m
  }, [grupos])

  // ---- período escolhido (ano todo ou um mês)
  const doPeriodo = useMemo(
    () => (mesSel === null ? txs : txs.filter((t) => Number(t.data.slice(5, 7)) - 1 === mesSel)),
    [txs, mesSel],
  )
  const entradas = doPeriodo.filter((t) => t.tipo === 'entrada').reduce((s, t) => s + emReal(t.valor, t.moeda), 0)
  const saidas = doPeriodo.filter((t) => t.tipo === 'saida').reduce((s, t) => s + emReal(t.valor, t.moeda), 0)
  const resultado = entradas - saidas
  const poupanca = entradas > 0 ? (resultado / entradas) * 100 : null

  const nomesCategorias = useMemo(
    () => plano.itens.map((i) => ({ id: i.id, name: nomeCategoria(plano, i.id) ?? i.name })),
    [plano],
  )
  const gruposPeriodo = useMemo(() => {
    const total = new Map<string, number>()
    for (const t of doPeriodo) {
      if (t.tipo !== 'saida') continue
      const g = (t.item_id && grupoDoItem.get(t.item_id)) || SEM_GRUPO
      total.set(g, (total.get(g) ?? 0) + emReal(t.valor, t.moeda))
    }
    return [...total.entries()]
      .map(([id, valor]) => ({
        id,
        nome: nomeGrupo(id),
        valor,
        pct: saidas > 0 ? (valor / saidas) * 100 : 0,
        cor: corDoGrupo.get(id) ?? COR_OUTROS,
      }))
      .sort((a, b) => b.valor - a.valor)
  }, [doPeriodo, grupoDoItem, emReal, nomeGrupo, saidas, corDoGrupo])
  const topCategorias = useMemo(
    () =>
      porCategoria(doPeriodo, nomesCategorias, 'saida', rates)
        .slice(0, 8)
        .map((c) => ({ id: c.id ?? 'sem', nome: c.name, valor: c.total, pct: c.pct, cor: 'var(--serie-2)' })),
    [doPeriodo, nomesCategorias, rates],
  )
  const fontesEntrada = useMemo(
    () =>
      porCategoria(doPeriodo, nomesCategorias, 'entrada', rates)
        .slice(0, 6)
        .map((c) => ({ id: c.id ?? 'sem', nome: c.name, valor: c.total, pct: c.pct, cor: 'var(--serie-1)' })),
    [doPeriodo, nomesCategorias, rates],
  )
  const maioresSaidas = useMemo(
    () =>
      doPeriodo
        .filter((t) => t.tipo === 'saida' && !t.recorrencia_id)
        .map((t) => ({ t, valor: emReal(t.valor, t.moeda) }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 8),
    [doPeriodo, emReal],
  )

  // ---- escalas
  const topoMes = topoDoEixo(Math.max(...meses.map((m) => Math.max(m.entradas, m.saidas))))
  const topoSaldo = topoDoEixo(Math.max(0, ...meses.map((m) => m.saldo)))
  const baseSaldo = -topoDoEixo(Math.max(0, ...meses.map((m) => -m.saldo)))
  const temNegativo = meses.some((m) => m.saldo < 0)
  const faixaSaldo = (temNegativo ? topoSaldo - baseSaldo : topoSaldo) || 1
  const topoGrupos = topoDoEixo(Math.max(...meses.map((m) => m.saidas)))
  const acumulados = meses.map((_, i) => meses.slice(0, i + 1).reduce((s, m) => s + m.saldo, 0))

  const rotuloPeriodo = mesSel === null ? `${ano}` : `${MESES_LONGOS[mesSel]} de ${ano}`
  const vazio = carregado && txs.length === 0

  return (
    <PageLayout title="Relatórios" description="Para onde vai e de onde vem o dinheiro" icon={BarChart3}>
      {/* Período */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => mudarAno(-1)} aria-label="Ano anterior">
            <ChevronLeft />
          </Button>
          <span className="w-14 text-center text-sm font-semibold tabular-nums">{ano}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => mudarAno(1)} aria-label="Próximo ano">
            <ChevronRight />
          </Button>
        </div>
        {mesSel !== null ? (
          <button
            type="button"
            onClick={() => setMesSel(null)}
            className="flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background"
          >
            Só {MESES_LONGOS[mesSel]}
            <X className="h-3.5 w-3.5" aria-label="Ver o ano todo" />
          </button>
        ) : (
          !vazio && <span className="text-xs text-muted-foreground">Clique num mês do gráfico pra ver só ele.</span>
        )}
      </div>

      {erro && <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}

      {vazio ? (
        <EmptyState
          icon={BarChart3}
          titulo={`Nenhum lançamento em ${ano}`}
          descricao="Registre entradas e saídas em Lançamentos pra ver os gráficos aqui."
        />
      ) : !carregado ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          {/* KPIs do período */}
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={`Entradas · ${rotuloPeriodo}`} value={formatBRL(entradas)} icon={ArrowUpRight} accent="success" />
            <StatCard label={`Saídas · ${rotuloPeriodo}`} value={formatBRL(saidas)} icon={ArrowDownRight} accent="destructive" />
            <StatCard
              label="Saldo"
              value={formatBRL(resultado)}
              icon={Scale}
              highlight
              sub={mesSel === null ? `Acumulado em ${ano}` : `Acumulado até ${MESES_CURTOS[mesSel]}: ${formatBRL(acumulados[mesSel])}`}
            />
            <StatCard
              label="Quanto sobrou"
              value={poupanca === null ? '—' : fmtPct(poupanca)}
              icon={PiggyBank}
              accent={poupanca !== null && poupanca < 0 ? 'destructive' : 'primary'}
              sub="Saldo dividido pelas entradas"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Entradas × saídas por mês */}
            <Card className="p-4 lg:col-span-2">
              <CabecalhoGrafico titulo="Entradas e saídas por mês" sub={`${ano}, convertido para real`}>
                <Legenda
                  itens={[
                    { cor: 'var(--serie-1)', label: 'Entradas' },
                    { cor: 'var(--serie-2)', label: 'Saídas' },
                  ]}
                />
              </CabecalhoGrafico>
              <div className="pl-14">
                <div className="relative h-56">
                  <Grade topo={topoMes} />
                  <div className="relative flex h-full items-end gap-1 sm:gap-2">
                    {meses.map((m, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => alternarMes(i)}
                        aria-pressed={mesSel === i}
                        aria-label={`${MESES_LONGOS[i]}: entradas ${formatBRL(m.entradas)}, saídas ${formatBRL(m.saidas)}`}
                        className={cn(
                          'group relative flex h-full flex-1 items-end justify-center gap-0.5 rounded-t-md outline-none transition-opacity hover:bg-muted/50 focus-visible:bg-muted/50',
                          mesSel !== null && mesSel !== i && 'opacity-35',
                        )}
                      >
                        <span className="w-full max-w-4 rounded-t-[4px]" style={{ height: `${(m.entradas / topoMes) * 100}%`, background: 'var(--serie-1)' }} />
                        <span className="w-full max-w-4 rounded-t-[4px]" style={{ height: `${(m.saidas / topoMes) * 100}%`, background: 'var(--serie-2)' }} />
                        <Tooltip i={i}>
                          <div className="mb-1 font-semibold capitalize">{MESES_LONGOS[i]}</div>
                          <LinhaTooltip cor="var(--serie-1)" label="Entradas" valor={formatBRL(m.entradas)} />
                          <LinhaTooltip cor="var(--serie-2)" label="Saídas" valor={formatBRL(m.saidas)} />
                          <LinhaTooltip forte label="Saldo" valor={formatBRL(m.saldo)} />
                        </Tooltip>
                      </button>
                    ))}
                  </div>
                </div>
                <EixoMeses mesSel={mesSel} />
              </div>
            </Card>

            {/* Saldo de cada mês */}
            <Card className="p-4">
              <CabecalhoGrafico titulo="Saldo de cada mês" sub={`Acumulado no ano: ${formatBRL(acumulados[11])}`}>
                <Legenda
                  itens={[
                    { cor: 'var(--serie-1)', label: 'Sobrou' },
                    { cor: 'var(--serie-2)', label: 'Faltou' },
                  ]}
                />
              </CabecalhoGrafico>
              <div className="pl-14">
                <div className="relative h-44">
                  <Grade topo={topoSaldo} base={temNegativo ? baseSaldo : 0} />
                  <div className="relative flex h-full gap-1 sm:gap-2">
                    {meses.map((m, i) => {
                      const zero = (topoSaldo / faixaSaldo) * 100 // posição do zero, do topo
                      const alt = (Math.abs(m.saldo) / faixaSaldo) * 100
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => alternarMes(i)}
                          aria-pressed={mesSel === i}
                          aria-label={`${MESES_LONGOS[i]}: saldo ${formatBRL(m.saldo)}`}
                          className={cn(
                            'group relative h-full flex-1 rounded-md outline-none transition-opacity hover:bg-muted/50 focus-visible:bg-muted/50',
                            mesSel !== null && mesSel !== i && 'opacity-35',
                          )}
                        >
                          <span
                            className={cn('absolute left-1/2 w-full max-w-5 -translate-x-1/2', m.saldo >= 0 ? 'rounded-t-[4px]' : 'rounded-b-[4px]')}
                            style={{
                              top: m.saldo >= 0 ? `${zero - alt}%` : `${zero}%`,
                              height: `${alt}%`,
                              background: m.saldo >= 0 ? 'var(--serie-1)' : 'var(--serie-2)',
                            }}
                          />
                          <Tooltip i={i}>
                            <div className="mb-1 font-semibold capitalize">{MESES_LONGOS[i]}</div>
                            <LinhaTooltip label="Saldo do mês" valor={formatBRL(m.saldo)} />
                            <LinhaTooltip forte label="Acumulado" valor={formatBRL(acumulados[i])} />
                          </Tooltip>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <EixoMeses mesSel={mesSel} />
              </div>
            </Card>

            {/* Saídas por grupo, mês a mês */}
            <Card className="p-4">
              <CabecalhoGrafico titulo="Saídas por grupo" sub="Os 5 grupos que mais gastaram no ano" />
              <div className="pl-14">
                <div className="relative h-44">
                  <Grade topo={topoGrupos} />
                  <div className="relative flex h-full items-end gap-1 sm:gap-2">
                    {meses.map((m, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => alternarMes(i)}
                        aria-pressed={mesSel === i}
                        aria-label={`${MESES_LONGOS[i]}: saídas ${formatBRL(m.saidas)}`}
                        className={cn(
                          'group relative flex h-full flex-1 flex-col-reverse items-center rounded-t-md outline-none transition-opacity hover:bg-muted/50 focus-visible:bg-muted/50',
                          mesSel !== null && mesSel !== i && 'opacity-35',
                        )}
                      >
                        {grupos.map((g, gi) =>
                          g.serie[i] > 0 ? (
                            <span
                              key={g.id}
                              className={cn(
                                'block w-full max-w-5 border-t-2 border-card first:border-t-0',
                                gi === grupos.findLastIndex((x) => x.serie[i] > 0) && 'rounded-t-[4px]',
                              )}
                              style={{ height: `${(g.serie[i] / topoGrupos) * 100}%`, background: corDoGrupo.get(g.id) }}
                            />
                          ) : null,
                        )}
                        <Tooltip i={i}>
                          <div className="mb-1 font-semibold capitalize">{MESES_LONGOS[i]}</div>
                          {grupos
                            .filter((g) => g.serie[i] > 0)
                            .map((g) => (
                              <LinhaTooltip key={g.id} cor={corDoGrupo.get(g.id)} label={nomeGrupo(g.id)} valor={formatBRL(g.serie[i])} />
                            ))}
                          <LinhaTooltip forte label="Total" valor={formatBRL(m.saidas)} />
                        </Tooltip>
                      </button>
                    ))}
                  </div>
                </div>
                <EixoMeses mesSel={mesSel} />
              </div>
              {grupos.length > 0 && (
                <div className="mt-3">
                  <Legenda itens={grupos.map((g) => ({ cor: corDoGrupo.get(g.id) ?? COR_OUTROS, label: nomeGrupo(g.id) }))} />
                </div>
              )}
            </Card>

            {/* Para onde foi */}
            <Card className="p-4">
              <CabecalhoGrafico titulo="Para onde foi o dinheiro" sub={`Saídas por grupo · ${rotuloPeriodo}`} />
              <Ranking linhas={gruposPeriodo} vazio="Sem saídas nesse período." />
            </Card>

            {/* Maiores categorias */}
            <Card className="p-4">
              <CabecalhoGrafico titulo="Maiores categorias de gasto" sub={rotuloPeriodo} />
              <Ranking linhas={topCategorias} vazio="Sem saídas nesse período." />
            </Card>

            {/* De onde veio */}
            <Card className="p-4">
              <CabecalhoGrafico titulo="De onde veio o dinheiro" sub={`Entradas por categoria · ${rotuloPeriodo}`} />
              <Ranking linhas={fontesEntrada} vazio="Sem entradas nesse período." />
            </Card>

            {/* Maiores saídas */}
            <Card className="overflow-hidden">
              <div className="p-4 pb-2">
                <CabecalhoGrafico titulo="Maiores saídas" sub={`Sem contar as recorrências · ${rotuloPeriodo}`} />
              </div>
              {maioresSaidas.length === 0 ? (
                <p className="pb-8 text-center text-sm text-muted-foreground">Sem saídas nesse período.</p>
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {maioresSaidas.map(({ t, valor }) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{t.descricao || 'Sem descrição'}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {formatData(t.data)} · {nomeCategoria(plano, t.item_id) ?? 'sem categoria'}
                        </div>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">{formatBRL(valor)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </PageLayout>
  )
}
