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
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-card px-4 py-3 md:px-6 md:py-4">
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
              <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
                <Icon className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold leading-tight md:text-xl">{title}</h1>
              {description && (
                <p className="truncate text-xs text-muted-foreground md:text-sm">{description}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
        <main className="animate-fade-in flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
  )
}
