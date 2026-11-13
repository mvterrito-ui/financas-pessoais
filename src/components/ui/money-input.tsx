'use client'

import * as React from 'react'
import { Input } from './input'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  /** Valor numérico como string ("7000.5") ou '' quando vazio. */
  value: string
  onValueChange: (value: string) => void
}

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Input monetário com máscara pt-BR (1.234,56). A digitação preenche a partir
 * dos centavos, como em app de banco: "7" → 0,07 · "700000" → 7.000,00.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, Props>(
  ({ value, onValueChange, ...props }, ref) => {
    const n = value === '' ? null : Number(value)
    const display = n === null || Number.isNaN(n) ? '' : fmt(n)

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        {...props}
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '')
          if (!digits) return onValueChange('')
          onValueChange(String(parseInt(digits, 10) / 100))
        }}
      />
    )
  },
)
MoneyInput.displayName = 'MoneyInput'
