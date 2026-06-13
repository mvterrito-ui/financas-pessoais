'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PieChart, Plus, Trash2, Wallet, Percent } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MonthPicker } from '@/components/ui/month-picker'
import { usePromptDialog } from '@/components/ui/prompt'
import { hojeISO, fimDoMes, rotuloMes } from '@/lib/utils'
import { formatBRL } from '@/server/fluxo/fluxo.calc'
import {
  alocar,
  somaPercentual,
  type BudgetBucket,
} from '@/server/orcamento/orcamento.calc'

export default function OrcamentoClient() {
  const router = useRouter()
  const ask = usePromptDialog()
  const [buckets, setBuckets] = useState<BudgetBucket[]>([])
  const [renda, setRenda] = useState(0)
  const [mes, setMes] = useState(hojeISO().slice(0, 7)) // 'AAAA-MM'
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

  const carregarBuckets = useCallback(async () => {
    try {
      setBuckets(await api('/api/budget'))
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [api])

  const carregarRenda = useCallback(async () => {
    try {
      const entradas = await api(
        `/api/transaction?de=${mes}-01&ate=${fimDoMes(mes)}&tipo=entrada`,
      )
      setRenda(
        (entradas as { valor: number | string }[]).reduce(
          (s, t) => s + Number(t.valor),
          0,
        ),
      )
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
  async function salvarPercentual(id: string, valor: string) {
    await api(`/api/budget/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percentual: Number(valor) || 0 }),
    })
  }

  async function novoBalde() {
    const v = await ask({
      title: 'Novo balde',
      fields: [
        { name: 'name', label: 'Nome do balde', placeholder: 'Viagem' },
        { name: 'pct', label: 'Percentual (%)', type: 'number' },
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
  }

  async function excluir(id: string) {
    if (!confirm('Remover este balde?')) return
    await api(`/api/budget/${id}`, { method: 'DELETE' })
    await carregarBuckets()
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
          📅 {rotuloMes(mes)}
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
          sub={somaOk ? 'Fechou 100% 👌' : 'O ideal é somar 100%'}
        />
      </div>

      {erro && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      {buckets.length === 0 ? (
        <EmptyState
          emoji="🎯"
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
          <table className="w-full text-sm">
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
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="h-9 w-24"
                      value={String(b.percentual)}
                      onChange={(e) => editarPercentual(b.id, e.target.value)}
                      onBlur={(e) => salvarPercentual(b.id, e.target.value)}
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
        </Card>
      )}
    </PageLayout>
  )
}
