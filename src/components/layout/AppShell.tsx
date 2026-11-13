'use client'

import { type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'

// Moldura do app: o Sidebar vive AQUI (no layout raiz), então NÃO é
// desmontado/recarregado a cada troca de tela — só o conteúdo muda.
// No /login não tem sidebar.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname === '/login') return <>{children}</>
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}
