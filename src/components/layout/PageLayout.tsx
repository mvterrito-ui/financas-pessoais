'use client'

import { type ReactNode } from 'react'
import { Menu, type LucideIcon } from 'lucide-react'
import { useAbrirMenu } from './AppShell'

interface PageLayoutProps {
  title: string
  description?: string
  icon?: LucideIcon
  actions?: ReactNode
  children: ReactNode
}

// Cabeçalho + conteúdo de toda página interna. O Sidebar fica no AppShell
// (layout raiz), pra não recarregar a cada navegação.
export function PageLayout({
  title,
  description,
  icon: Icon,
  actions,
  children,
}: PageLayoutProps) {
  const abrirMenu = useAbrirMenu()
  return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="relative z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/70 bg-card/80 px-4 py-3 backdrop-blur-md md:px-8 md:py-4">
          <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
            <button
              type="button"
              onClick={abrirMenu}
              aria-label="Abrir menu"
              className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-muted md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            {Icon && (
              <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#10b981] to-[#047857] text-white shadow-md shadow-emerald-700/25 ring-1 ring-white/20 sm:flex">
                <Icon className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold leading-tight tracking-tight md:text-[1.35rem]">{title}</h1>
              {description && (
                <p className="truncate text-xs text-muted-foreground md:text-sm">{description}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="animate-fade-in mx-auto w-full max-w-[1500px] p-4 md:p-8">{children}</div>
        </main>
      </div>
  )
}
