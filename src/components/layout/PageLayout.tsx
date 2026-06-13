import { type ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'
import { Sidebar } from './Sidebar'

interface PageLayoutProps {
  title: string
  description?: string
  icon?: LucideIcon
  actions?: ReactNode
  children: ReactNode
}

// Moldura padrão de toda página interna: sidebar + cabeçalho + conteúdo.
export function PageLayout({
  title,
  description,
  icon: Icon,
  actions,
  children,
}: PageLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
            )}
            <div>
              <h1 className="text-xl font-semibold leading-tight">{title}</h1>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
        <main className="animate-fade-in flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
