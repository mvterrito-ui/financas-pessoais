'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'

// Abre/fecha o menu no celular (o botão de menu fica no cabeçalho de cada página).
const MenuCtx = createContext<() => void>(() => {})
export const useAbrirMenu = () => useContext(MenuCtx)

// Moldura do app: o Sidebar vive AQUI (no layout raiz), então NÃO é
// desmontado/recarregado a cada troca de tela — só o conteúdo muda.
// Desktop: menu fixo à esquerda. Celular: menu em gaveta. No /login, nada.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [menuAberto, setMenuAberto] = useState(false)
  if (pathname === '/login') return <>{children}</>
  return (
    <MenuCtx.Provider value={() => setMenuAberto(true)}>
      <div className="flex h-dvh overflow-hidden">
        <Sidebar aberto={menuAberto} onFechar={() => setMenuAberto(false)} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </MenuCtx.Provider>
  )
}
