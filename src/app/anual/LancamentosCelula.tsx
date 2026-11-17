'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MoneyCommit, MoneyInput } from '@/components/ui/money-input'
import { DiaField } from '@/components/ui/number-field'
import { simboloMoeda } from '@/components/ui/moeda-toggle'
import { formatData, rotuloMes } from '@/lib/utils'
import type { Transaction } from '@/server/fluxo/fluxo.calc'

// Lançamentos que formam uma célula do realizado (categoria + mês), editáveis
// ali mesmo. Usado quando a célula tem mais de um lançamento ou outra moeda.
export function LancamentosCelula({
  titulo,
  mes,
  lancamentos,
  desfeito,
  onFechar,
  onValor,
  onRemover,
  onNovo,
}: {
  titulo: string
  /** AAAA-MM-01 */
  mes: string
  lancamentos: Transaction[]
  desfeito: number
  onFechar: () => void
  onValor: (t: Transaction, valor: string) => void
  onRemover: (t: Transaction) => void
  onNovo: (valor: number, dia: number) => void
}) {
  const [valor, setValor] = useState('')
  const [dia, setDia] = useState(String(new Date().getDate()))

  function adicionar() {
    if (!(Number(valor) > 0)) return
    onNovo(Number(valor), Math.max(1, Number(dia) || 1))
    setValor('')
  }

  return (
    <Modal open onClose={onFechar} title={`${titulo} · ${rotuloMes(mes.slice(0, 7))}`}>
      {lancamentos.length === 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">Nenhum lançamento nesse mês.</p>
      ) : (
        <ul className="mb-4 divide-y divide-border rounded-lg border border-border">
          {lancamentos.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{t.descricao || 'Sem descrição'}</div>
                <div className="text-xs text-muted-foreground">
                  {formatData(t.data)}
                  {t.parcela_total ? ` · parcela ${t.parcela_num}/${t.parcela_total}` : ''}
                </div>
              </div>
              <MoneyCommit
                key={`${t.valor}-${desfeito}`}
                className="w-36"
                aria-label={`Valor de ${t.descricao || 'lançamento'} em ${formatData(t.data)}`}
                prefixo={simboloMoeda(t.moeda ?? 'BRL')}
                inicial={String(t.valor)}
                onCommit={(v) => onValor(t, v)}
              />
              <button
                type="button"
                onClick={() => onRemover(t)}
                aria-label={`Excluir ${t.descricao || 'lançamento'}`}
                title="Excluir lançamento"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          adicionar()
        }}
        className="flex items-end gap-2"
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="cel-valor">Novo lançamento</Label>
          <MoneyInput id="cel-valor" prefixo="R$" placeholder="0,00" value={valor} onValueChange={setValor} />
        </div>
        <div className="w-24 space-y-1.5">
          <Label htmlFor="cel-dia">Dia</Label>
          <DiaField id="cel-dia" value={dia} onValueChange={setDia} />
        </div>
        <Button type="submit" disabled={!(Number(valor) > 0)}>
          <Plus /> Adicionar
        </Button>
      </form>

      <div className="mt-4 flex justify-between gap-2">
        <Link
          href="/fluxo"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Abrir em Lançamentos
        </Link>
        <Button variant="outline" onClick={onFechar}>
          Fechar
        </Button>
      </div>
    </Modal>
  )
}
