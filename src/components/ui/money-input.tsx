'use client'

import * as React from 'react'
import { CampoShell, campoInputClass, useCommit, type Tamanho } from './campo'

type Base = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'defaultValue' | 'prefix'
> & {
  /** Símbolo dentro do campo, à esquerda ("R$", "US$", "€"). */
  prefixo?: string
  tamanho?: Tamanho
  /** Aceita negativo (ex: prejuízo). Digite "-" pra trocar o sinal. */
  permitirNegativo?: boolean
}

type Props = Base & {
  /** Valor numérico como string ("7000.5") ou '' quando vazio. */
  value: string
  onValueChange: (value: string) => void
}

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Input monetário com máscara pt-BR (1.234,56). A digitação preenche a partir
 * dos centavos, como em app de banco: "7" → 0,07 · "700000" → 7.000,00.
 * Enter confirma (tira o foco → dispara o onBlur de quem usa).
 * `className` estiliza a caixa externa.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, Props>(
  (
    { value, onValueChange, prefixo, tamanho = 'md', permitirNegativo, className, onKeyDown, ...props },
    ref,
  ) => {
    const n = value === '' ? null : Number(value)
    const display = n === null || Number.isNaN(n) ? '' : (Object.is(n, -0) ? '-' : '') + fmt(n)

    return (
      <CampoShell prefixo={prefixo} tamanho={tamanho} className={className}>
        <input
          ref={ref}
          type="text"
          inputMode={permitirNegativo ? 'text' : 'numeric'}
          autoComplete="off"
          {...props}
          className={campoInputClass(tamanho)}
          value={display}
          onChange={(e) => {
            const txt = e.target.value
            const neg = permitirNegativo && txt.includes('-')
            const digits = txt.replace(/\D/g, '')
            if (!digits) return onValueChange(neg ? '-0' : '')
            const v = parseInt(digits, 10) / 100
            onValueChange(neg ? (v === 0 ? '-0' : String(-v)) : String(v))
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            onKeyDown?.(e)
          }}
        />
      </CampoShell>
    )
  },
)
MoneyInput.displayName = 'MoneyInput'

/** MoneyInput de tabela: recebe o valor salvo e chama `onCommit` ao sair, se mudou. */
export function MoneyCommit({
  inicial,
  onCommit,
  ...props
}: Base & { inicial: number | string; onCommit: (valor: string) => void }) {
  const { valor, setValor, commit } = useCommit(String(inicial ?? ''), onCommit)
  return (
    <MoneyInput
      tamanho="sm"
      {...props}
      value={valor}
      onValueChange={setValor}
      onBlur={commit}
    />
  )
}
