'use client'

import { cn } from '@/lib/utils'

export type MoedaCodigo = 'BRL' | 'USD' | 'EUR'

export const MOEDAS: { moeda: MoedaCodigo; simbolo: string }[] = [
  { moeda: 'BRL', simbolo: 'R$' },
  { moeda: 'USD', simbolo: 'US$' },
  { moeda: 'EUR', simbolo: '€' },
]

export const simboloMoeda = (m: MoedaCodigo) => MOEDAS.find((x) => x.moeda === m)!.simbolo

/** Seletor de moeda em botões (R$ | US$ | €) — padrão do app. */
export function MoedaToggle({
  value,
  onChange,
  tamanho = 'md',
  label = 'Moeda',
  className,
}: {
  value: MoedaCodigo
  onChange: (m: MoedaCodigo) => void
  tamanho?: 'sm' | 'md'
  label?: string
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center rounded-lg bg-muted p-0.5',
        tamanho === 'sm' ? 'h-9' : 'h-10',
        className,
      )}
    >
      {MOEDAS.map((m) => {
        const ativa = m.moeda === value
        return (
          <button
            key={m.moeda}
            type="button"
            role="radio"
            aria-checked={ativa}
            onClick={() => !ativa && onChange(m.moeda)}
            className={cn(
              'h-full rounded-md px-2.5 text-xs font-semibold transition-all',
              ativa ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m.simbolo}
          </button>
        )
      })}
    </div>
  )
}
