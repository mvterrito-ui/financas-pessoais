'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input } from './input'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  /** Valor numérico como string ("7000.5") ou '' quando vazio. */
  value: string
  onValueChange: (value: string) => void
  /** Símbolo dentro do campo, à esquerda ("R$", "US$", "€"). */
  prefixo?: string
}

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Input monetário com máscara pt-BR (1.234,56). A digitação preenche a partir
 * dos centavos, como em app de banco: "7" → 0,07 · "700000" → 7.000,00.
 * Enter confirma (tira o foco → dispara o onBlur de quem usa).
 * Com `prefixo`, vira o campo "grande" (símbolo dentro, valor em destaque);
 * nesse modo, `className` estiliza a caixa externa.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, Props>(
  ({ value, onValueChange, prefixo, className, onKeyDown, ...props }, ref) => {
    const n = value === '' ? null : Number(value)
    const display = n === null || Number.isNaN(n) ? '' : fmt(n)

    const inputProps = {
      ref,
      type: 'text',
      inputMode: 'numeric' as const,
      autoComplete: 'off',
      ...props,
      value: display,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '')
        onValueChange(digits ? String(parseInt(digits, 10) / 100) : '')
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        onKeyDown?.(e)
      },
    }

    if (!prefixo) return <Input {...inputProps} className={className} />

    return (
      <label
        className={cn(
          'flex h-11 cursor-text items-center gap-2 rounded-xl border border-input bg-card px-3 shadow-sm transition-all',
          'hover:border-primary/40 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15',
          className,
        )}
      >
        <span className="select-none text-xs font-semibold text-muted-foreground">{prefixo}</span>
        <input
          {...inputProps}
          className="w-full min-w-0 bg-transparent text-right text-base font-semibold tabular-nums text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/50"
        />
      </label>
    )
  },
)
MoneyInput.displayName = 'MoneyInput'
