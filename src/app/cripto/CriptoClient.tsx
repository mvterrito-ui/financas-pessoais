'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bitcoin,
  Plus,
  Trash2,
  Wallet,
  TrendingUp,
  TrendingDown,
  Percent,
  ArrowLeftRight,
  ChevronRight,
} from 'lucide-react'
import { invalidarSincronizacao } from '@/lib/sincronizar'
import { useCotacao } from '@/lib/useRates'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MoneyCommit } from '@/components/ui/money-input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { usePromptDialog } from '@/components/ui/prompt'
import { formatBRL } from '@/server/fluxo/fluxo.calc'
import {
  anosDisponiveis,
  aoEditar,
  valorAtualLinha,
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
  const usd = useCotacao().rates.USD
  const [erro, setErro] = useState<string | null>(null)

  // detalhe (destrinchar) de uma corretora
  const [detalhe, setDetalhe] = useState<CryptoSummary | null>(null)
  const [detItens, setDetItens] = useState<CryptoItem[]>([])

  const api = useCallback(
    async (url: string, init?: RequestInit) => {
      // Mexeu num investimento -> o Patrimônio sincroniza na próxima visita.
      if (init?.method && init.method !== 'GET') invalidarSincronizacao()
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

  // Na tela: Aplicado e Valor atual. O lucro/prejuízo (resultado) é calculado.
  async function salvar(exchange: string, campo: 'aplicado' | 'atual', valor: string) {
    const linha = linhas.find((l) => l.exchange === exchange)
    setErro(null)
    try {
      await api('/api/crypto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange, ano, ...aoEditar(linha, campo, Number(valor) || 0) }),
      })
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function novaCorretora() {
    try {
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
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function excluir(id: string) {
    try {
      if (!confirm('Remover esta corretora deste ano?')) return
      await api(`/api/crypto/${id}`, { method: 'DELETE' })
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  // ---- detalhe da corretora ----
  const carregarDetalhe = useCallback(
    async (summaryId: string) => {
      setDetItens(await api(`/api/crypto-item?summary_id=${summaryId}`))
    },
    [api],
  )

  async function abrirDetalhe(l: CryptoSummary) {
    setDetItens([]) // não mostrar (nem somar) os itens da corretora anterior
    setDetalhe(l)
    setErro(null)
    try {
      await carregarDetalhe(l.id)
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function novoItem() {
    try {
      if (!detalhe) return
      const v = await ask({
        title: 'Novo item',
        fields: [
          { name: 'label', label: 'Nome', placeholder: 'TRADE, HOLD, LTC…' },
          { name: 'valor', label: 'Valor', type: 'money', prefixo: 'US$' },
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
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  // Depois de salvar, recarrega os itens: a soma (e o "usar como valor atual")
  // usava os valores antigos.
  async function salvarItem(id: string, valor: string) {
    if (!detalhe) return
    try {
      await api(`/api/crypto-item/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: Number(valor) || 0 }),
      })
      await carregarDetalhe(detalhe.id)
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function excluirItem(id: string) {
    if (!detalhe || !confirm('Remover este item do detalhamento?')) return
    try {
      await api(`/api/crypto-item/${id}`, { method: 'DELETE' })
      await carregarDetalhe(detalhe.id)
    } catch (e) {
      setErro((e as Error).message)
    }
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
          <ArrowLeftRight className="mr-1 inline h-3 w-3" />
          USD {formatBRL(usd)}
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
          icon={Bitcoin}
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
          <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Corretora</th>
                <th className="px-4 py-3 font-medium">Aplicado</th>
                <th className="px-4 py-3 font-medium">Valor atual</th>
                <th className="px-4 py-3 font-medium">Lucro/Prejuízo</th>
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
                        {l.exchange}
                        <ChevronRight className="ml-0.5 inline h-3.5 w-3.5" />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <MoneyCommit
                        prefixo="US$"
                        aria-label={`Aplicado em ${l.exchange}`}
                        inicial={l.aplicado}
                        className="w-36"
                        onCommit={(v) => salvar(l.exchange, 'aplicado', v)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <MoneyCommit
                        prefixo="US$"
                        title="Quanto vale hoje na corretora"
                        aria-label={`Valor atual em ${l.exchange}`}
                        inicial={valorAtualLinha(l)}
                        className="w-36"
                        onCommit={(v) => salvar(l.exchange, 'atual', v)}
                      />
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 font-semibold tabular-nums ${Number(l.resultado) >= 0 ? 'text-emerald-600' : 'text-destructive'}`}
                    >
                      {Number(l.resultado) >= 0 ? '+' : ''}
                      {fmtUSD(Number(l.resultado))}
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
                        aria-label="Remover corretora"
                        title="Remover corretora"
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
                <td className="px-4 py-3 tabular-nums">{fmtUSD(t.aplicado + t.resultado)}</td>
                <td
                  className={`px-4 py-3 tabular-nums ${t.resultado >= 0 ? 'text-emerald-600' : 'text-destructive'}`}
                >
                  {fmtUSD(t.resultado)}
                </td>
                <td className="px-4 py-3" colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
          </div>
        </Card>
      )}

      {/* Modal de detalhamento da corretora */}
      <Modal
        open={detalhe !== null}
        onClose={() => setDetalhe(null)}
        title={detalhe ? `Detalhamento · ${detalhe.exchange} ${detalhe.ano}` : ''}
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
                  <MoneyCommit
                    prefixo="US$"
                    aria-label={`Valor de ${it.label}`}
                    inicial={it.valor}
                    className="w-36"
                    onCommit={(v) => salvarItem(it.id, v)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => excluirItem(it.id)}
                        aria-label="Remover item"
                        title="Remover item"
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
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Aplicado: {fmtUSD(Number(detalhe.aplicado))} · Valor atual na tabela:{' '}
                {fmtUSD(valorAtualLinha(detalhe))}
              </span>
              {detItens.length > 0 && somaItens(detItens) !== valorAtualLinha(detalhe) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await salvar(detalhe.exchange, 'atual', String(somaItens(detItens)))
                    setDetalhe(null)
                  }}
                >
                  Usar a soma como valor atual
                </Button>
              )}
            </div>
          )}
        </div>
      </Modal>
    </PageLayout>
  )
}
