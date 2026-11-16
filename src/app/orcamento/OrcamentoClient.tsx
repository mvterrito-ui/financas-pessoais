'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CircleAlert, Pencil, Percent, PieChart, Plus, Receipt, Trash2, Wallet } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MonthPicker } from '@/components/ui/month-picker'
import { NumberCommit } from '@/components/ui/number-field'
import { usePromptDialog } from '@/components/ui/prompt'
import { cn, fimDoMes, hojeISO, rotuloMes } from '@/lib/utils'
import { useCotacao } from '@/lib/useRates'
import { formatBRL, valorEmBRL, type Moeda, type Transaction } from '@/server/fluxo/fluxo.calc'
import { alocar, somaPercentual, usoPorFatia, type BudgetBucket } from '@/server/orcamento/orcamento.calc'

const fmtPct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`

export default function OrcamentoClient() {
  const router = useRouter()
  const ask = usePromptDialog()
  const { rates } = useCotacao()
  const [mes, setMes] = useState(hojeISO().slice(0, 7)) // AAAA-MM
  const [fatias, setFatias] = useState<BudgetBucket[]>([])
  const [txs, setTxs] = useState<Transaction[]>([])
  const [carregado, setCarregado] = useState(false)
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
  const enviar = useCallback(
    (url: string, method: string, body?: unknown) =>
      api(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    [api],
  )

  const buscarFatias = useCallback(() => api('/api/budget') as Promise<BudgetBucket[]>, [api])
  const recarregar = useCallback(() => buscarFatias().then(setFatias), [buscarFatias])

  useEffect(() => {
    let vivo = true
    buscarFatias()
      .then((f) => vivo && setFatias(f))
      .catch((e) => vivo && setErro((e as Error).message))
      .finally(() => vivo && setCarregado(true))
    return () => {
      vivo = false
    }
  }, [buscarFatias])

  useEffect(() => {
    let vivo = true
    api(`/api/transaction?de=${mes}-01&ate=${fimDoMes(mes)}`)
      .then((t) => vivo && setTxs(t))
      .catch((e) => vivo && setErro((e as Error).message))
    return () => {
      vivo = false
    }
  }, [api, mes])

  // Executa uma ação; em erro mostra a mensagem e recarrega o que está salvo.
  async function acao(fn: () => Promise<unknown>) {
    setErro(null)
    try {
      await fn()
    } catch (e) {
      setErro((e as Error).message)
    }
    await recarregar().catch(() => {})
  }

  async function novaFatia() {
    const v = await ask({
      title: 'Nova fatia',
      fields: [
        { name: 'name', label: 'Nome', placeholder: 'Gastos fixos, Reserva, Lazer…' },
        { name: 'pct', label: 'Percentual das entradas', type: 'number', sufixo: '%' },
      ],
    })
    if (!v?.name) return
    acao(() =>
      enviar('/api/budget', 'POST', { name: v.name, percentual: Number(v.pct) || 0, ordem: fatias.length + 1 }),
    )
  }

  async function renomear(f: BudgetBucket) {
    const v = await ask({ title: 'Renomear fatia', fields: [{ name: 'name', label: 'Nome', valor: f.name }] })
    if (!v?.name || v.name === f.name) return
    acao(() => enviar(`/api/budget/${f.id}`, 'PATCH', { name: v.name }))
  }

  function salvarPct(f: BudgetBucket, texto: string) {
    const pct = Number(texto) || 0
    if (pct === Number(f.percentual)) return
    setFatias((fs) => fs.map((x) => (x.id === f.id ? { ...x, percentual: pct } : x)))
    acao(() => enviar(`/api/budget/${f.id}`, 'PATCH', { percentual: pct }))
  }

  function remover(f: BudgetBucket) {
    if (!confirm(`Remover a fatia "${f.name}"?\n\nOs lançamentos e recorrências dela ficam sem fatia.`)) return
    acao(() => enviar(`/api/budget/${f.id}`, 'DELETE'))
  }

  // ---- números do mês
  const emReal = useCallback(
    (v: number | string, m?: string | null) => valorEmBRL(v, (m ?? 'BRL') as Moeda, rates),
    [rates],
  )
  const entradas = txs.filter((t) => t.tipo === 'entrada').reduce((s, t) => s + emReal(t.valor, t.moeda), 0)
  const saidas = useMemo(() => txs.filter((t) => t.tipo === 'saida'), [txs])
  const gasto = saidas.reduce((s, t) => s + emReal(t.valor, t.moeda), 0)
  const { porFatia, semFatia } = useMemo(() => usoPorFatia(saidas, fatias, emReal), [saidas, fatias, emReal])
  const alocacoes = alocar(entradas, fatias)
  const soma = somaPercentual(fatias)
  const somaOk = Math.abs(soma - 100) < 0.005

  return (
    <PageLayout
      title="Orçamento"
      description="Como dividir as entradas do mês"
      icon={PieChart}
      actions={
        <Button onClick={novaFatia}>
          <Plus /> Nova fatia
        </Button>
      }
    >
      <div className="mb-4 space-y-1">
        <Label className="text-xs text-muted-foreground">Mês</Label>
        <MonthPicker value={mes} onChange={setMes} />
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <StatCard
          label={`Entradas de ${rotuloMes(mes)}`}
          value={formatBRL(entradas)}
          icon={Wallet}
          highlight
          sub="Total do orçamento"
        />
        <StatCard
          label="Soma das fatias"
          value={fmtPct(soma)}
          icon={Percent}
          accent={somaOk ? 'primary' : 'warning'}
          sub={
            somaOk
              ? 'Todas as entradas têm destino'
              : soma < 100
                ? `Faltam ${fmtPct(100 - soma)} sem destino`
                : `Passou ${fmtPct(soma - 100)} das entradas`
          }
        />
        <StatCard
          label="Saídas do mês"
          value={formatBRL(gasto)}
          icon={Receipt}
          accent={entradas > 0 && gasto > entradas ? 'destructive' : 'default'}
          sub={entradas > 0 ? `${fmtPct((gasto / entradas) * 100)} das entradas` : 'Sem entradas no mês'}
        />
      </div>

      {erro && <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}

      {carregado && fatias.length === 0 ? (
        <EmptyState
          icon={PieChart}
          titulo="Nenhuma fatia ainda"
          descricao="Divida as entradas do mês em fatias (ex.: Gastos fixos 50%, Reserva 20%, Lazer 10%) Depois, escolha a fatia de cada saída nos lançamentos."
          acao={
            <Button onClick={novaFatia}>
              <Plus /> Nova fatia
            </Button>
          }
        />
      ) : (
        <Card className="mb-5 overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1fr)_7rem_8rem_minmax(0,16rem)_4.5rem] gap-4 border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid">
            <span>Fatia</span>
            <span>%</span>
            <span className="text-right">Cabe no mês</span>
            <span>Usado</span>
            <span />
          </div>
          <ul>
            {alocacoes.map((f) => {
              const usado = porFatia.get(f.id) ?? 0
              const resta = f.valor - usado
              const passou = resta < 0
              const qtd = saidas.filter((t) => t.budget_id === f.id).length
              return (
                <li
                  key={f.id}
                  className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 last:border-0 md:grid-cols-[minmax(0,1fr)_7rem_8rem_minmax(0,16rem)_4.5rem]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{f.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {qtd === 0 ? 'Nenhuma saída no mês' : qtd === 1 ? '1 saída no mês' : `${qtd} saídas no mês`}
                    </div>
                  </div>
                  <NumberCommit
                    key={`${f.id}-${f.percentual}`}
                    inicial={String(f.percentual)}
                    sufixo="%"
                    aria-label={`Percentual de ${f.name}`}
                    onCommit={(v) => salvarPct(f, v)}
                  />
                  <div className="text-sm font-medium tabular-nums md:text-right">
                    <span className="text-xs font-normal text-muted-foreground md:hidden">Cabe: </span>
                    {formatBRL(f.valor)}
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm tabular-nums">
                      <span className={cn('font-medium', passou && 'text-destructive')}>{formatBRL(usado)}</span>
                      <span className="text-xs text-muted-foreground">
                        {passou ? `passou ${formatBRL(-resta)}` : `resta ${formatBRL(resta)}`}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full', passou ? 'bg-destructive' : 'bg-primary')}
                        style={{ width: `${f.valor > 0 ? Math.min(100, (usado / f.valor) * 100) : usado > 0 ? 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="col-span-2 flex justify-end gap-1 md:col-span-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => renomear(f)} aria-label="Renomear fatia" title="Renomear fatia">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remover(f)} aria-label="Remover fatia" title="Remover fatia">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {semFatia > 0 && (
        <p className="mb-5 flex items-start gap-2 text-sm text-muted-foreground">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          {formatBRL(semFatia)} em saídas sem fatia.
          <Link href="/fluxo" className="font-medium text-primary hover:underline">
            Ver lançamentos
          </Link>
        </p>
      )}

    </PageLayout>
  )
}
