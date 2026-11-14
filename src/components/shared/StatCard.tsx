import { type ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Accent = 'default' | 'primary' | 'success' | 'destructive' | 'warning'

interface StatCardProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon?: LucideIcon
  accent?: Accent
  /** Indicador principal da tela: fundo escuro da marca com brilho esmeralda. */
  highlight?: boolean
}

const valueColor: Record<Accent, string> = {
  default: 'text-foreground',
  primary: 'text-primary',
  success: 'text-emerald-600',
  destructive: 'text-destructive',
  warning: 'text-amber-600',
}
// No fundo escuro (highlight) as cores precisam ser mais claras pra contrastar.
const valueColorEscuro: Record<Accent, string> = {
  default: 'text-white',
  primary: 'text-white',
  success: 'text-emerald-300',
  destructive: 'text-red-300',
  warning: 'text-amber-300',
}

const iconColor: Record<Accent, string> = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/10 text-emerald-600',
  destructive: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/15 text-amber-600',
}

// Valor: rótulo+ícone em cima e o número embaixo, com a largura toda (o número
// nunca invade o ícone); o tamanho acompanha a tela.
const VALOR =
  'text-[clamp(1.3rem,0.95rem+0.75vw,1.65rem)] font-semibold leading-tight tracking-tight tabular-nums break-words'

// Card de indicador (KPI) padronizado, usado nos resumos das telas.
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'default',
  highlight,
}: StatCardProps) {
  if (highlight) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-sidebar p-4 text-white shadow-[0_8px_30px_-12px_rgba(6,78,59,0.55)] ring-1 ring-black/5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(80% 90% at 100% 0%, rgba(52,211,153,0.28), transparent 60%), radial-gradient(60% 60% at 0% 100%, rgba(5,150,105,0.25), transparent 70%)',
          }}
        />
        <div className="relative flex items-center justify-between gap-3">
          <div className="min-w-0 text-[13px] font-medium leading-snug text-emerald-100/75">{label}</div>
          {Icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-200 ring-1 ring-white/15">
              <Icon className="h-[17px] w-[17px]" />
            </span>
          )}
        </div>
        <div className={cn('relative mt-2', VALOR, valueColorEscuro[accent])}>{value}</div>
        {sub && <div className="relative mt-1 text-xs text-emerald-100/60">{sub}</div>}
      </div>
    )
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-[13px] font-medium leading-snug text-muted-foreground">{label}</div>
        {Icon && (
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              iconColor[accent],
            )}
          >
            <Icon className="h-[17px] w-[17px]" />
          </span>
        )}
      </div>
      <div className={cn('mt-2', VALOR, valueColor[accent])}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  )
}
