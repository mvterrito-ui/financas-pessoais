import { type ReactNode } from 'react'

interface EmptyStateProps {
  emoji?: string
  titulo: string
  descricao?: string
  acao?: ReactNode
}

// Estado vazio amigável: emoji em círculo + título + descrição + ação opcional.
export function EmptyState({ emoji = '📭', titulo, descricao, acao }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-2xl">
        {emoji}
      </span>
      <p className="font-medium">{titulo}</p>
      {descricao && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{descricao}</p>
      )}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}
