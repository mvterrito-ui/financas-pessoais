'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const MESES_CURTO = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

// Seletor de mês clicável (gradinha de meses + navegação de ano), no lugar do
// <input type="month"> nativo (que em alguns navegadores só deixa digitar).
// value/onChange usam 'AAAA-MM'.
export function MonthPicker({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  const [aberto, setAberto] = useState(false)
  const [anoVisivel, setAnoVisivel] = useState(() => Number(value.slice(0, 4)))
  const ref = useRef<HTMLDivElement>(null)

  const anoSel = Number(value.slice(0, 4))
  const mesSel = Number(value.slice(5, 7)) // 1-12

  // Quando o value muda por fora, acompanha o ano mostrado.
  useEffect(() => setAnoVisivel(Number(value.slice(0, 4))), [value])

  // Fecha ao clicar fora.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    if (aberto) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [aberto])

  function selecionar(mes1a12: number) {
    onChange(`${anoVisivel}-${String(mes1a12).padStart(2, '0')}`)
    setAberto(false)
  }

  // Pula 'delta' meses (setas ‹ › do gatilho), virando o ano quando precisa.
  function passo(delta: number) {
    const d = new Date(anoSel, mesSel - 1 + delta, 1)
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div ref={ref} className={cn('relative inline-flex items-center gap-1', className)}>
      <button
        type="button"
        onClick={() => passo(-1)}
        aria-label="Mês anterior"
        className="flex h-10 w-9 items-center justify-center rounded-lg border border-input bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => setAberto((o) => !o)}
        className="flex h-10 min-w-44 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
      >
        <Calendar className="h-4 w-4 text-muted-foreground" />
        {MESES[mesSel - 1]} {anoSel}
      </button>

      <button
        type="button"
        onClick={() => passo(1)}
        aria-label="Próximo mês"
        className="flex h-10 w-9 items-center justify-center rounded-lg border border-input bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {aberto && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-card p-3 shadow-lg">
          {/* Navegação de ano */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setAnoVisivel((a) => a - 1)}
              aria-label="Ano anterior"
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">{anoVisivel}</span>
            <button
              type="button"
              onClick={() => setAnoVisivel((a) => a + 1)}
              aria-label="Próximo ano"
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Gradinha de meses */}
          <div className="grid grid-cols-3 gap-1">
            {MESES_CURTO.map((m, i) => {
              const selecionado = i + 1 === mesSel && anoVisivel === anoSel
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => selecionar(i + 1)}
                  className={cn(
                    'rounded-md px-2 py-2 text-sm transition-colors',
                    selecionado
                      ? 'bg-primary font-medium text-primary-foreground'
                      : 'hover:bg-muted',
                  )}
                >
                  {m}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Seletor de mês para formulário: campo do tamanho de um <Input> que abre a
// gradinha de meses logo abaixo (no fluxo da página, então funciona dentro de
// modal sem ser cortado). value/onChange usam 'AAAA-MM'; '' = sem mês, só
// quando `vazio` é informado (ex.: "Sem data pra acabar").
export function MesCampo({
  id,
  value,
  onChange,
  min,
  vazio,
  className,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  min?: string
  vazio?: string
  className?: string
}) {
  const [aberto, setAberto] = useState(false)
  const base = value || min || new Date().toISOString().slice(0, 7)
  const [anoVisivel, setAnoVisivel] = useState(() => Number(base.slice(0, 4)))
  const anoSel = value ? Number(value.slice(0, 4)) : null
  const mesSel = value ? Number(value.slice(5, 7)) : null

  function abrir() {
    setAnoVisivel(Number(base.slice(0, 4)))
    setAberto((o) => !o)
  }
  function escolher(v: string) {
    onChange(v)
    setAberto(false)
  }

  return (
    <div className={className}>
      <button
        id={id}
        type="button"
        onClick={abrir}
        aria-expanded={aberto}
        className="flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm shadow-sm transition-all hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
      >
        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className={cn('truncate', !value && 'text-muted-foreground')}>
          {value ? `${MESES_CURTO[mesSel! - 1]} ${anoSel}` : (vazio ?? 'Escolher')}
        </span>
      </button>

      {aberto && (
        <div className="mt-1.5 rounded-xl border border-border bg-card p-2 shadow-sm">
          <div className="mb-1.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setAnoVisivel((a) => a - 1)}
              aria-label="Ano anterior"
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">{anoVisivel}</span>
            <button
              type="button"
              onClick={() => setAnoVisivel((a) => a + 1)}
              aria-label="Próximo ano"
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MESES_CURTO.map((m, i) => {
              const v = `${anoVisivel}-${String(i + 1).padStart(2, '0')}`
              const fora = !!min && v < min
              return (
                <button
                  key={m}
                  type="button"
                  disabled={fora}
                  onClick={() => escolher(v)}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-35',
                    v === value ? 'bg-primary font-medium text-primary-foreground' : 'hover:bg-muted',
                  )}
                >
                  {m}
                </button>
              )
            })}
          </div>
          {vazio && (
            <button
              type="button"
              onClick={() => escolher('')}
              className={cn(
                'mt-1 w-full rounded-md px-2 py-1.5 text-sm transition-colors',
                !value ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {vazio}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
