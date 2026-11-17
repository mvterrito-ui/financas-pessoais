'use client'

import * as React from 'react'
import { CampoShell, campoInputClass, useCommit, type Tamanho } from './campo'

type Base = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'defaultValue' | 'prefix'
> & {
  prefixo?: string
  /** Unidade à direita ("%", "% a.m.", "cotas"...). */
  sufixo?: string
  tamanho?: Tamanho
  /** Casas decimais aceitas (0 = inteiro). Padrão 2. */
  casas?: number
}

type Props = Base & {
  /** Número como string com PONTO ("10.5") ou ''. Na tela aparece com vírgula. */
  value: string
  onValueChange: (value: string) => void
}

// Aceita vírgula ou ponto como decimal; devolve sempre com ponto.
export function normalizarNumero(txt: string, casas: number): string {
  let limpo = txt.replace(/[^\d.,]/g, '')
  // Colou "1.234,56" (formato BR completo): os pontos são milhar, não decimal.
  if (limpo.includes('.') && limpo.includes(',')) limpo = limpo.replace(/\./g, '')
  const t = limpo.replace(/\./g, ',')
  const [int, ...resto] = t.split(',')
  if (casas === 0 || !t.includes(',')) return int
  return `${int || '0'}.${resto.join('').slice(0, casas)}`
}

/** Campo numérico (quantidade, %, parcelas) no mesmo visual do MoneyInput. */
export const NumberField = React.forwardRef<HTMLInputElement, Props>(
  (
    { value, onValueChange, prefixo, sufixo, tamanho = 'md', casas = 2, className, onKeyDown, ...props },
    ref,
  ) => (
    <CampoShell prefixo={prefixo} sufixo={sufixo} tamanho={tamanho} className={className}>
      <input
        ref={ref}
        type="text"
        inputMode={casas === 0 ? 'numeric' : 'decimal'}
        autoComplete="off"
        {...props}
        className={campoInputClass(tamanho)}
        value={value.replace('.', ',')}
        onChange={(e) => onValueChange(normalizarNumero(e.target.value, casas))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          onKeyDown?.(e)
        }}
      />
    </CampoShell>
  ),
)
NumberField.displayName = 'NumberField'

/** NumberField de tabela: recebe o valor salvo e chama `onCommit` ao sair, se mudou. */
export function NumberCommit({
  inicial,
  onCommit,
  ...props
}: Base & { inicial: number | string; onCommit: (valor: string) => void }) {
  const { valor, setValor, commit } = useCommit(String(inicial ?? ''), onCommit)
  return (
    <NumberField tamanho="sm" {...props} value={valor} onValueChange={setValor} onBlur={commit} />
  )
}

/** Dia do mês digitado: só números, no máximo 2 dígitos e nunca acima de 31. */
export function limitarDia(txt: string): string {
  const d = txt.replace(/\D/g, '').slice(0, 2)
  return d && Number(d) > 31 ? '31' : d
}

/** Campo de dia do mês (1 a 31). */
export const DiaField = React.forwardRef<HTMLInputElement, Omit<Props, 'casas'>>(
  ({ onValueChange, onBlur, value, ...props }, ref) => (
    <NumberField
      ref={ref}
      placeholder="1 a 31"
      {...props}
      value={value}
      casas={0}
      maxLength={2}
      onValueChange={(v) => onValueChange(limitarDia(v))}
      onBlur={(e) => {
        if (value !== '' && Number(value) < 1) onValueChange('1')
        onBlur?.(e)
      }}
    />
  ),
)
DiaField.displayName = 'DiaField'
