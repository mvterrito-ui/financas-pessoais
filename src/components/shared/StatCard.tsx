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
  highlight?: boolean
}

const valueColor: Record<Accent, string> = {
  default: 'text-foreground',
  primary: 'text-primary',
  success: 'text-emerald-600',
  destructive: 'text-destructive',
  warning: 'text-amber-600',
}

const iconColor: Record<Accent, string> = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/10 text-emerald-600',
  destructive: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/15 text-amber-600',
}

// Card de indicador (KPI) padronizado, usado nos resumos das telas.
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'default',
  highlight,
}: StatCardProps) {
  return (
    <Card className={cn('p-4', highlight && 'border-primary/30 bg-primary/5')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm text-muted-foreground">{label}</div>
          <div className={cn('mt-1 text-2xl font-semibold tabular-nums', valueColor[accent])}>
            {value}
          </div>
          {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
        </div>
        {Icon && (
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              iconColor[accent],
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>
    </Card>
  )
}
