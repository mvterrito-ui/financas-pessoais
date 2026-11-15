import { cn } from '@/lib/utils'

/**
 * Marca do app: três barras crescendo num quadrado verde. Mesmo desenho do
 * ícone da aba (src/app/icon.svg).
 */
export function Marca({ tamanho = 40, className }: { tamanho?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={tamanho}
      height={tamanho}
      aria-hidden
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id="marca-fundo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#marca-fundo)" />
      <rect x="10" y="21" width="5" height="9" rx="1.6" fill="#fff" fillOpacity="0.6" />
      <rect x="17.5" y="16" width="5" height="14" rx="1.6" fill="#fff" fillOpacity="0.8" />
      <rect x="25" y="10" width="5" height="20" rx="1.6" fill="#fff" />
    </svg>
  )
}
