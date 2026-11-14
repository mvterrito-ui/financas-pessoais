import * as React from 'react'
import { cn } from '@/lib/utils'

// Card padrão: canto 2xl, borda suave e sombra em camadas (leve, não "flutua").
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-card text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.10)]',
        className,
      )}
      {...props}
    />
  )
}
