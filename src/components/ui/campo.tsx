import * as React from 'react'
import { cn } from '@/lib/utils'

// Visual ÚNICO dos campos de valor do app (dinheiro, quantidade, %).
// Caixa com símbolo/unidade dentro e o número em destaque à direita.
//   tamanho 'md' -> formulários e o Patrimônio (h-10, igual ao <Input>)
//   tamanho 'sm' -> células de tabela (h-9)

export type Tamanho = 'sm' | 'md'

export const campoFoco =
  'hover:border-primary/40 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15'

export function CampoShell({
  prefixo,
  sufixo,
  tamanho = 'md',
  className,
  children,
}: {
  prefixo?: string
  sufixo?: string
  tamanho?: Tamanho
  className?: string
  children: React.ReactNode
}) {
  return (
    <label
      className={cn(
        'flex cursor-text items-center gap-2 rounded-lg border border-input bg-card shadow-sm transition-all',
        campoFoco,
        tamanho === 'sm' ? 'h-9 px-2.5' : 'h-10 px-3',
        className,
      )}
    >
      {prefixo && (
        <span className="shrink-0 select-none text-xs font-semibold text-muted-foreground">
          {prefixo}
        </span>
      )}
      {children}
      {sufixo && (
        <span className="shrink-0 select-none text-xs font-semibold text-muted-foreground">
          {sufixo}
        </span>
      )}
    </label>
  )
}

export function campoInputClass(tamanho: Tamanho = 'md') {
  return cn(
    'w-full min-w-0 bg-transparent text-right font-semibold tabular-nums text-foreground outline-none',
    'placeholder:font-normal placeholder:text-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-50',
    tamanho === 'sm' ? 'text-sm' : 'text-base',
  )
}

/**
 * Pra campos que salvam AO SAIR (tabelas): guarda o texto local, dispara
 * `onCommit` no blur só se mudou, e se o valor vindo de fora mudar (recarga
 * do servidor), adota o novo. Padrão "ajustar estado quando a prop muda".
 */
export function useCommit(inicial: string, onCommit: (v: string) => void) {
  const [valor, setValor] = React.useState(inicial)
  const [anterior, setAnterior] = React.useState(inicial)
  if (inicial !== anterior) {
    setAnterior(inicial)
    setValor(inicial)
  }
  const commit = () => {
    if (Number(valor || 0) !== Number(inicial || 0)) onCommit(valor)
  }
  return { valor, setValor, commit }
}
