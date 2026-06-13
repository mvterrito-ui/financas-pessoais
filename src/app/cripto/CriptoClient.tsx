'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bitcoin, Plus, Trash2, Wallet, TrendingUp, TrendingDown, Percent } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { usePromptDialog } from '@/components/ui/prompt'
import { formatBRL } from '@/server/fluxo/fluxo.calc'
import {
  anosDisponiveis,
  retornoPct,
  somaItens,
  totais,
  type CryptoItem,
  type CryptoSummary,
} from '@/server/cripto/cripto.calc'

const ANO_ATUAL = Number(new Date().toISOString().slice(0, 4))
const fmtUSD = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' })

export default function CriptoClient() {
  const router = useRouter()
  const ask = usePromptDialog()
  const [itens, setItens] = useState<CryptoSummary[]>([])
  const [ano, setAno] = useState(ANO_ATUAL)
  const [usd, setUsd] = useState(5.4)
  const [erro, setErro] = useState<string | null>(null)

  // detalhe (destrinchar) de uma corretora
  const [detalhe, setDetalhe] = useState<CryptoSummary | null>(null)
  const [detItens, setDetItens] = useState<CryptoItem[]>([])

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
      setItens(await api('/api/crypto'))
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [api])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL')
      .then((r) => r.json())
      .then((d) => setUsd(Number(d.USDBRL.bid)))
      .catch(() => {})
  }, [])

  // anos com dados; se vazio, oferece o atual. Garante que `ano` é válido.
  const anos = useMemo(() => {
    const a = anosDisponiveis(itens)
    return a.length ? a : [ANO_ATUAL]
  }, [itens])
  useEffect(() => {
    if (!anos.includes(ano)) setAno(anos[0])
  }, [anos, ano])

  const linhas = useMemo(() => itens.filter((i) => i.ano === ano), [itens, ano])
  const t = totais(linhas)

  async function salvar(exchange: string, campo: 'aplicado' | 'resultado', valor: string) {
    const atual = linhas.find((l) => l.exchange === exchange)
    setErro(null)
    try {
      await api('/api/crypto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange,
          ano,
          aplicado: Number(campo === 'aplicado' ? valor : (atual?.aplicado ?? 0)) || 0,
          resultado: Number(campo === 'resultado' ? valor : (atual?.resultado ?? 0)) || 0,
        }),
      })
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function novaCorretora() {
    const v = await ask({
      title: 'Nova corretora',
      fields: [{ name: 'exchange', label: 'Nome da corretora', placeholder: 'Binance' }],
    })
    if (!v?.exchange) return
    await api('/api/crypto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchange: v.exchange, ano, aplicado: 0, resultado: 0 }),
    })
    await carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Remover esta corretora deste ano?')) return
    await api(`/api/crypto/${id}`, { method: 'DELETE' })
    await carregar()
  }

  // ---- detalhe da corretora ----
  const carregarDetalhe = useCallback(
    async (summaryId: string) => {
      setDetItens(await api(`/api/crypto-item?summary_id=${summaryId}`))
    },
    [api],
  )

  async function abrirDetalhe(l: CryptoSummary) {
    setDetalhe(l)
    setErro(null)
    await carregarDetalhe(l.id)
  }

  async function novoItem() {
    if (!detalhe) return
    const v = await ask({
      title: 'Novo item',
      fields: [
        { name: 'label', label: 'Nome', placeholder: 'TRADE, HOLD, LTC…' },
        { name: 'valor', label: 'Valor (US$)', type: 'number' },
      ],
    })
    if (!v?.label) return
    await api('/api/crypto-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary_id: detalhe.id,
        label: v.label,
        valor: Number(v.valor) || 0,
        ordem: detItens.length + 1,
      }),
    })
    await carregarDetalhe(detalhe.id)
  }

  async function salvarItem(id: string, valor: string) {
    await api(`/api/crypto-item/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: Number(valor) || 0 }),
    })
  }

  async function excluirItem(id: string) {
    if (!detalhe) return
    await api(`/api/crypto-item/${id}`, { method: 'DELETE' })
    await carregarDetalhe(detalhe.id)
  }

  return (
    <PageLayout
      title="Cripto"
      description="Resumo por corretora (valores em US$)"
      icon={Bitcoin}
      actions={
        <Button onClick={novaCorretora}>
          <Plus /> Nova corretora
        </Button>
      }
    >
      {/* Ano + cotação */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select className="w-28" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
        <span className="ml-auto self-center text-xs text-muted-foreground">
          💱 USD {formatBRL(usd)}
        </span>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total aplicado"
          value={fmtUSD(t.aplicado)}
          icon={Wallet}
          accent="default"
          sub={`≈ ${formatBRL(t.aplicado * usd)}`}
        />
        <StatCard
          label="Lucro / Prejuízo"
          value={fmtUSD(t.resultado)}
          icon={t.resultado >= 0 ? TrendingUp : TrendingDown}
          accent={t.resultado >= 0 ? 'success' : 'destructive'}
          sub={`≈ ${formatBRL(t.resultado * usd)}`}
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

      {linhas.length === 0 ? (
        <EmptyState
          emoji="🪙"
          titulo={`Sem corretoras em ${ano}`}
          descricao="Adicione uma corretora pra registrar quanto aplicou e o resultado."
          acao={
            <Button onClick={novaCorretora}>
              <Plus /> Nova corretora
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Corretora</th>
                <th className="px-4 py-3 font-medium">Aplicado (US$)</th>
                <th className="px-4 py-3 font-medium">Lucro/Prejuízo (US$)</th>
                <th className="px-4 py-3 font-medium">Retorno</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const ret = retornoPct(Number(l.aplicado), Number(l.resultado))
                return (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => abrirDetalhe(l)}
                        className="font-medium text-primary underline-offset-2 hover:underline"
                        title="Ver detalhamento"
                      >
                        {l.exchange} 🔎
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={String(l.aplicado)}
                        className="h-9 w-32"
                        onBlur={(e) => salvar(l.exchange, 'aplicado', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={String(l.resultado)}
                        className="h-9 w-32"
                        onBlur={(e) => salvar(l.exchange, 'resultado', e.target.value)}
                      />
                    </td>
                    <td
                      className={`px-4 py-3 font-semibold tabular-nums ${Number(l.resultado) >= 0 ? 'text-emerald-600' : 'text-destructive'}`}
                    >
                      {ret === null
                        ? '—'
                        : `${ret >= 0 ? '+' : ''}${ret.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => excluir(l.id)}
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
                <td className="px-4 py-3 tabular-nums">{fmtUSD(t.aplicado)}</td>
                <td
                  className={`px-4 py-3 tabular-nums ${t.resultado >= 0 ? 'text-emerald-600' : 'text-destructive'}`}
                >
                  {fmtUSD(t.resultado)}
                </td>
                <td className="px-4 py-3" colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      {/* Modal de detalhamento da corretora */}
      <Modal
        open={detalhe !== null}
        onClose={() => setDetalhe(null)}
        title={detalhe ? `${detalhe.exchange} · ${detalhe.ano} — detalhe 🔎` : ''}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Composição (US$)</Label>
            <Button variant="outline" size="sm" onClick={novoItem}>
              <Plus /> Item
            </Button>
          </div>

          {detItens.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sem itens. Adicione (ex: TRADE, HOLD, LTC…) pra destrinchar.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {detItens.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="flex-1 font-medium">{it.label}</span>
                  <span className="text-sm text-muted-foreground">US$</span>
                  <Input
                    type="number"
                    step="0.01"
                    defaultValue={String(it.valor)}
                    className="h-8 w-28 text-right"
                    onBlur={(e) => salvarItem(it.id, e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => excluirItem(it.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {detItens.length > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium">Soma dos itens</span>
              <span className="font-semibold tabular-nums">{fmtUSD(somaItens(detItens))}</span>
            </div>
          )}
          {detalhe && (
            <p className="text-xs text-muted-foreground">
              Aplicado informado na corretora: {fmtUSD(Number(detalhe.aplicado))}.
            </p>
          )}
        </div>
      </Modal>
    </PageLayout>
  )
}
