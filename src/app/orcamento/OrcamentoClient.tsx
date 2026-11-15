'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PieChart,
  Plus,
  Trash2,
  Wallet,
  Percent,
  CalendarDays,
} from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NumberField } from '@/components/ui/number-field'
import { Label } from '@/components/ui/label'
import { MonthPicker } from '@/components/ui/month-picker'
import { usePromptDialog } from '@/components/ui/prompt'
import { hojeISO, fimDoMes, rotuloMes } from '@/lib/utils'
import { formatBRL, valorEmBRL, type Moeda } from '@/server/fluxo/fluxo.calc'
import { useRates } from '@/lib/useRates'
import {
  alocar,
  somaPercentual,
  type BudgetBucket,
} from '@/server/orcamento/orcamento.calc'

export default function OrcamentoClient() {
  const router = useRouter()
  const ask = usePromptDialog()
  const rates = useRates()
  const [buckets, setBuckets] = useState<BudgetBucket[]>([])
  const [entradasMes, setEntradasMes] = useState<{ valor: number | string; moeda?: Moeda }[]>([])
  const [mes, setMes] = useState(hojeISO().slice(0, 7)) // 'AAAA-MM'
  const [erro, setErro] = useState<string | null>(null)

  // Renda do mês JÁ convertida pra real (entradas em € usam cotação ao vivo).
  const renda = entradasMes.reduce((s, t) => s + valorEmBRL(t.valor, t.moeda, rates), 0)

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

  // % que está SALVO no servidor (a tela edita uma cópia local pro preview).
  const salvosPct = useRef(new Map<string, number>())
  const carregarBuckets = useCallback(async () => {
    try {
      const lista = (await api('/api/budget')) as BudgetBucket[]
      salvosPct.current = new Map(lista.map((b) => [b.id, Number(b.percentual)]))
      setBuckets(lista)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [api])

  const carregarRenda = useCallback(async () => {
    try {
      const entradas = await api(
        `/api/transaction?de=${mes}-01&ate=${fimDoMes(mes)}&tipo=entrada`,
      )
      setEntradasMes(entradas as { valor: number | string; moeda?: Moeda }[])
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [api, mes])

  useEffect(() => {
    carregarBuckets()
  }, [carregarBuckets])
  useEffect(() => {
    carregarRenda()
  }, [carregarRenda])

  // Edita o % localmente (preview ao vivo) e salva no banco ao sair do campo.
  function editarPercentual(id: string, valor: string) {
    setBuckets((bs) =>
      bs.map((b) => (b.id === id ? { ...b, percentual: valor } : b)),
    )
  }
  // Só salva se mudou; se falhar, volta o valor salvo (a tela não pode
  // mostrar como salvo algo que o servidor recusou).
  async function salvarPercentual(id: string, valor: string) {
    const novo = Number(valor) || 0
    const salvo = salvosPct.current.get(id)
    if (novo === salvo) return
    try {
      await api(`/api/budget/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percentual: novo }),
      })
      salvosPct.current.set(id, novo)
    } catch (e) {
      setErro((e as Error).message)
      if (salvo !== undefined) editarPercentual(id, String(salvo))
    }
  }

  async function novoBalde() {
    try {
      const v = await ask({
        title: 'Novo balde',
        fields: [
          { name: 'name', label: 'Nome do balde', placeholder: 'Viagem' },
          { name: 'pct', label: 'Percentual', type: 'number', sufixo: '%' },
        ],
      })
      if (!v?.name) return
      await api('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: v.name,
          percentual: Number(v.pct) || 0,
          ordem: buckets.length + 1,
        }),
      })
      await carregarBuckets()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function excluir(id: string) {
    try {
      if (!confirm('Remover este balde?')) return
      await api(`/api/budget/${id}`, { method: 'DELETE' })
      await carregarBuckets()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  const soma = somaPercentual(buckets)
  const somaOk = Math.round(soma * 100) === 10000 // 100,00
  const alocacoes = alocar(renda, buckets)

  return (
    <PageLayout
      title="Orçamento"
      description="Como dividir sua renda do mês"
      icon={PieChart}
      actions={
        <Button onClick={novoBalde}>
          <Plus /> Novo balde
        </Button>
      }
    >
      {/* Mês */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mês</Label>
          <MonthPicker value={mes} onChange={setMes} />
        </div>
        <span className="ml-auto self-center text-sm text-muted-foreground">
          <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
          {rotuloMes(mes)}
        </span>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <StatCard
          label="Renda do mês (entradas)"
          value={formatBRL(renda)}
          icon={Wallet}
          accent="success"
        />
        <StatCard
          label="Soma dos percentuais"
          value={`${soma.toLocaleString('pt-BR')}%`}
          icon={Percent}
          accent={somaOk ? 'primary' : 'warning'}
          sub={somaOk ? 'Soma 100%' : 'O ideal é somar 100%'}
        />
      </div>

      {erro && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      {buckets.length === 0 ? (
        <EmptyState
          icon={PieChart}
          titulo="Nenhum balde ainda"
          descricao="Crie baldes (ex: Geral 50%, Reserva 10%) pra dividir sua renda."
          acao={
            <Button onClick={novoBalde}>
              <Plus /> Novo balde
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Balde</th>
                <th className="px-4 py-3 font-medium">%</th>
                <th className="px-4 py-3 text-right font-medium">Vai receber</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {alocacoes.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td className="px-4 py-3">
                    <NumberField
                      tamanho="sm"
                      sufixo="%"
                      aria-label={`Percentual de ${b.name}`}
                      className="w-24"
                      value={String(b.percentual)}
                      onValueChange={(v) => editarPercentual(b.id, v)}
                      onBlur={(e) => salvarPercentual(b.id, e.target.value.replace(',', '.'))}
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-600">
                    {formatBRL(b.valor)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => excluir(b.id)}
                        aria-label="Remover balde"
                        title="Remover balde"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/30">
                <td className="px-4 py-3 font-medium">Total</td>
                <td className={`px-4 py-3 font-medium ${somaOk ? '' : 'text-amber-600'}`}>
                  {soma.toLocaleString('pt-BR')}%
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">
                  {formatBRL(alocacoes.reduce((s, b) => s + b.valor, 0))}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          </div>
        </Card>
      )}
    </PageLayout>
  )
}
