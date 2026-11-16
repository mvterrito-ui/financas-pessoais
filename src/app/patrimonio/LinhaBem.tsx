'use client'

import {
  Check,
  EyeOff,
  Loader2,
  Trash2,
  TriangleAlert,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { MoneyInput } from '@/components/ui/money-input'
import { MoedaToggle, simboloMoeda } from '@/components/ui/moeda-toggle'
import { cn } from '@/lib/utils'
import { formatBRL } from '@/server/fluxo/fluxo.calc'
import { emBRL, type Moeda, type Rates, type WealthPlace } from '@/server/patrimonio/patrimonio.calc'

export type StatusSalvar = 'salvando' | 'salvo' | 'erro'

const fmtMoeda = (v: number, moeda: Moeda) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: moeda })

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : (p[0]?.[1] ?? ''))).toUpperCase()
}

/** Uma linha de bem MANUAL do Patrimônio: nome, moeda, valor e contexto. */
export function LinhaBem({
  place,
  valor,
  anterior,
  rates,
  status,
  onChange,
  onSave,
  onMoeda,
  onHide,
  onRemove,
}: {
  place: WealthPlace
  valor: string
  /** Valor (moeda nativa) no mês anterior, ou null se não havia. */
  anterior: number | null
  rates: Rates
  status?: StatusSalvar
  onChange: (valor: string) => void
  onSave: () => void
  onMoeda: (moeda: Moeda) => void
  onHide: () => void
  onRemove: () => void
}) {
  const vazio = valor === ''
  const nativo = Number(valor) || 0
  const diff = anterior === null || vazio ? 0 : nativo - anterior

  return (
    <div className="group flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 transition-colors hover:bg-muted/30 sm:flex-nowrap">
      {/* Identidade + contexto */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
          {iniciais(place.name)}
        </span>
        <div className="min-w-0">
          <div className="truncate font-medium">{place.name}</div>
          <div className="flex h-4 items-center gap-1.5 text-xs text-muted-foreground">
            {status === 'salvando' ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
              </>
            ) : status === 'salvo' ? (
              <span className="flex items-center gap-1 font-medium text-success">
                <Check className="h-3 w-3" /> Salvo
              </span>
            ) : status === 'erro' ? (
              <span className="flex items-center gap-1 font-medium text-destructive">
                <TriangleAlert className="h-3 w-3" /> Erro ao salvar
              </span>
            ) : vazio ? (
              <span>Sem valor neste mês</span>
            ) : (
              <>
                {diff !== 0 && (
                  <span className={cn('font-medium', diff > 0 ? 'text-success' : 'text-destructive')}>
                    {diff > 0 ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />}{' '}
                    {fmtMoeda(Math.abs(diff), place.moeda)}
                  </span>
                )}
                {diff !== 0 && <span>vs mês anterior</span>}
                {diff === 0 && anterior !== null && <span>Igual ao mês anterior</span>}
                {place.moeda !== 'BRL' && nativo > 0 && (
                  <span>
                    {diff !== 0 || anterior !== null ? '· ' : ''}≈{' '}
                    {formatBRL(emBRL(nativo, place.moeda, rates))}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Moeda + valor + remover */}
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <MoedaToggle label={`Moeda de ${place.name}`} value={place.moeda} onChange={onMoeda} />

        <MoneyInput
          prefixo={simboloMoeda(place.moeda)}
          placeholder="0,00"
          aria-label={`Valor de ${place.name}`}
          className="flex-1 sm:w-44 sm:flex-none"
          value={valor}
          onValueChange={onChange}
          onBlur={onSave}
        />

        <div className="flex shrink-0 items-center transition-opacity focus-within:opacity-100 desk:opacity-0 desk:group-hover:opacity-100">
          <button
            type="button"
            onClick={onHide}
            title={`Ocultar ${place.name} da lista (continua no total)`}
            aria-label={`Ocultar ${place.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <EyeOff className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            title={`Remover ${place.name} (apaga do histórico)`}
            aria-label={`Remover ${place.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
