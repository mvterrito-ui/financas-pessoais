'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Landmark, Plus, Trash2, Wallet, TrendingUp, TrendingDown, Percent } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePromptDialog } from '@/components/ui/prompt'
import { formatData } from '@/lib/utils'
import { formatBRL } from '@/server/fluxo/fluxo.calc'
import {
  rendimento,
  retornoPct,
  totais,
  type FixedIncome,
} from '@/server/renda-fixa/renda-fixa.calc'

export default function RendaFixaClient() {
  const router = useRouter()
  const ask = usePromptDialog()
  const [itens, setItens] = useState<FixedIncome[]>([])
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
      setItens(await api('/api/fixed-income'))
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [api])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function salvar(id: string, campo: 'valor_aplicado' | 'valor_atual', valor: string) {
    setErro(null)
    try {
      await api(`/api/fixed-income/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: Number(valor) || 0 }),
      })
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function novo() {
    const v = await ask({
      title: 'Nova aplicação',
      fields: [
        { name: 'nome', label: 'Título', placeholder: 'Tesouro Selic 2029, CDB Banco X…' },
        { name: 'instituicao', label: 'Instituição', placeholder: 'XP, Nubank…' },
        { name: 'tipo', label: 'Tipo', placeholder: 'Tesouro, CDB, LCI…' },
        { name: 'valor_aplicado', label: 'Valor aplicado (R$)', type: 'number' },
        { name: 'valor_atual', label: 'Valor atual (R$)', type: 'number' },
        { name: 'vencimento', label: 'Vencimento (opcional)', type: 'text', placeholder: 'AAAA-MM-DD' },
      ],
    })
    if (!v?.nome) return
    await api('/api/fixed-income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: v.nome,
        instituicao: v.instituicao || null,
        tipo: v.tipo || null,
        valor_aplicado: Number(v.valor_aplicado) || 0,
        valor_atual: Number(v.valor_atual) || 0,
        vencimento: /^\d{4}-\d{2}-\d{2}$/.test(v.vencimento ?? '') ? v.vencimento : null,
      }),
    })
    await carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Remover esta aplicação?')) return
    await api(`/api/fixed-income/${id}`, { method: 'DELETE' })
    await carregar()
  }

  const t = totais(itens)

  return (
    <PageLayout
      title="Renda Fixa"
      description="Tesouro, CDB, LCI/LCA e afins"
      icon={Landmark}
      actions={
        <Button onClick={novo}>
          <Plus /> Nova aplicação
        </Button>
      }
    >
      {/* KPIs */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Aplicado" value={formatBRL(t.aplicado)} icon={Wallet} />
        <StatCard label="Valor atual" value={formatBRL(t.atual)} icon={Landmark} accent="primary" />
        <StatCard
          label="Rendimento"
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
          emoji="🏦"
          titulo="Nenhuma aplicação ainda"
          descricao="Adicione seus títulos de renda fixa (Tesouro, CDB, LCI/LCA…)."
          acao={
            <Button onClick={novo}>
              <Plus /> Nova aplicação
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Título</th>
                <th className="px-4 py-3 font-medium">Aplicado</th>
                <th className="px-4 py-3 font-medium">Atual</th>
                <th className="px-4 py-3 font-medium">Vencimento</th>
                <th className="px-4 py-3 text-right font-medium">Rendimento</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((f) => {
                const r = rendimento(f)
                const ret = retornoPct(Number(f.valor_aplicado), r)
                return (
                  <tr key={f.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{f.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {[f.tipo, f.instituicao].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={String(f.valor_aplicado)}
                        className="h-9 w-28"
                        onBlur={(e) => salvar(f.id, 'valor_aplicado', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={String(f.valor_atual)}
                        className="h-9 w-28"
                        onBlur={(e) => salvar(f.id, 'valor_atual', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {f.vencimento ? formatData(f.vencimento) : '—'}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold tabular-nums ${r >= 0 ? 'text-emerald-600' : 'text-destructive'}`}
                    >
                      {r >= 0 ? '+' : ''}
                      {formatBRL(r)}
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
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 tabular-nums">{formatBRL(t.aplicado)}</td>
                <td className="px-4 py-3 tabular-nums text-primary">{formatBRL(t.atual)}</td>
                <td></td>
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
        </Card>
      )}
    </PageLayout>
  )
}
