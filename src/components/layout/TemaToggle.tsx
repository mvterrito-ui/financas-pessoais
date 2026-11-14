'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { aplicarTema, lerPreferencia, salvarPreferencia, type PreferenciaTema } from '@/lib/tema'

const OPCOES: { valor: PreferenciaTema; label: string; icon: typeof Sun }[] = [
  { valor: 'claro', label: 'Claro', icon: Sun },
  { valor: 'escuro', label: 'Escuro', icon: Moon },
  { valor: 'sistema', label: 'Sistema', icon: Monitor },
]

// A preferência mora no localStorage (só existe no navegador): lida com
// useSyncExternalStore — no servidor vale 'sistema', sem erro de hidratação.
const ouvintes = new Set<() => void>()
function assinar(avisar: () => void) {
  ouvintes.add(avisar)
  window.addEventListener('storage', avisar) // outra aba mudou o tema
  return () => {
    ouvintes.delete(avisar)
    window.removeEventListener('storage', avisar)
  }
}

/** Claro / Escuro / Sistema (segue o aparelho e muda junto com ele). */
export function TemaToggle() {
  const pref = useSyncExternalStore(assinar, lerPreferencia, () => 'sistema' as const)

  // No modo "sistema", acompanha quando o aparelho troca claro/escuro.
  useEffect(() => {
    aplicarTema(pref)
    if (pref !== 'sistema') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const mudou = () => aplicarTema('sistema')
    mq.addEventListener('change', mudou)
    return () => mq.removeEventListener('change', mudou)
  }, [pref])

  return (
    <div role="radiogroup" aria-label="Tema" className="flex rounded-xl bg-white/[0.05] p-1 ring-1 ring-white/[0.06]">
      {OPCOES.map(({ valor, label, icon: Icon }) => {
        const ativo = pref === valor
        return (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            title={`Tema ${label.toLowerCase()}`}
            onClick={() => {
              salvarPreferencia(valor)
              ouvintes.forEach((avisar) => avisar())
            }}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all',
              ativo ? 'bg-white/[0.12] text-white shadow-sm' : 'text-sidebar-foreground/55 hover:text-white',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
