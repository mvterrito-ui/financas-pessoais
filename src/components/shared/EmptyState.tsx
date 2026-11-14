import { type ReactNode } from 'react'

interface EmptyStateProps {
  emoji?: string
  titulo: string
  descricao?: string
  acao?: ReactNode
}

// Estado vazio amigável: emoji num círculo com halo + título + descrição + ação.
export function EmptyState({ emoji = '📭', titulo, descricao, acao }: EmptyStateProps) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{ background: 'radial-gradient(50% 100% at 50% 0%, rgba(16,185,129,0.10), transparent 70%)' }}
      />
      <span className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-3xl shadow-md ring-1 ring-border">
        {emoji}
      </span>
      <p className="relative text-base font-semibold tracking-tight">{titulo}</p>
      {descricao && (
        <p className="relative mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{descricao}</p>
      )}
      {acao && <div className="relative mt-5">{acao}</div>}
    </div>
  )
}
