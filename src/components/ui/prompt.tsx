'use client'

import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import { Modal } from './modal'
import { Input } from './input'
import { Label } from './label'
import { Button } from './button'

// Substituto do window.prompt() (que não funciona no webview do VSCode).
// Uso:  const ask = usePromptDialog()
//       const v = await ask({ title: 'Novo X', fields: [{ name:'nome', label:'Nome' }] })
//       if (!v) return  // cancelou
type Field = { name: string; label: string; type?: 'text' | 'number'; placeholder?: string }
type Config = { title: string; fields: Field[]; submitLabel?: string }
type Valores = Record<string, string>

const Ctx = createContext<(cfg: Config) => Promise<Valores | null>>(async () => null)

export function PromptProvider({ children }: { children: ReactNode }) {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [vals, setVals] = useState<Valores>({})
  const resolver = useRef<((v: Valores | null) => void) | null>(null)

  function ask(c: Config) {
    setCfg(c)
    setVals(Object.fromEntries(c.fields.map((f) => [f.name, ''])))
    return new Promise<Valores | null>((res) => {
      resolver.current = res
    })
  }

  function fechar(result: Valores | null) {
    resolver.current?.(result)
    resolver.current = null
    setCfg(null)
  }

  return (
    <Ctx.Provider value={ask}>
      {children}
      <Modal open={cfg !== null} onClose={() => fechar(null)} title={cfg?.title ?? ''}>
        {cfg && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              fechar(vals)
            }}
            className="space-y-3"
          >
            {cfg.fields.map((f, i) => (
              <div key={f.name} className="space-y-1.5">
                <Label>{f.label}</Label>
                <Input
                  type={f.type ?? 'text'}
                  step={f.type === 'number' ? 'any' : undefined}
                  placeholder={f.placeholder}
                  value={vals[f.name] ?? ''}
                  onChange={(e) => setVals((v) => ({ ...v, [f.name]: e.target.value }))}
                  autoFocus={i === 0}
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => fechar(null)}>
                Cancelar
              </Button>
              <Button type="submit">{cfg.submitLabel ?? 'Adicionar'}</Button>
            </div>
          </form>
        )}
      </Modal>
    </Ctx.Provider>
  )
}

export function usePromptDialog() {
  return useContext(Ctx)
}
