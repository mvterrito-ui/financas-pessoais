'use client'

import { useEffect, useRef } from 'react'
import { cn, rotuloMes } from '@/lib/utils'
import { formatBRL } from '@/server/fluxo/fluxo.calc'

// Barras da evolução mês a mês (Visão geral e Patrimônio): só os últimos
// `meses` meses. Em tela estreita a área rola na horizontal e abre já no mês
// mais recente. Janeiro leva o ano
// no rótulo pra não confundir quando aparecem dois anos.
export function EvolucaoBarras({
  serie: completa,
  alturaBarra,
  meses = 12,
}: {
  serie: { mes: string; total: number }[]
  /** Altura máxima da barra, em px. */
  alturaBarra: number
  meses?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const serie = completa.slice(-meses)
  const max = Math.max(1, ...serie.map((p) => p.total))

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [serie.length])

  return (
    <div ref={ref} className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex min-w-full items-end gap-2" style={{ height: alturaBarra + 40 }}>
        {serie.map((p, i) => {
          const ym = p.mes.slice(0, 7)
          const nome = rotuloMes(ym).slice(0, 3)
          return (
            <div key={p.mes} className="flex min-w-9 flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {(p.total / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k
              </span>
              <div
                className={cn(
                  'w-full max-w-10 rounded-t-[4px] transition-colors',
                  i === serie.length - 1 ? 'bg-primary' : 'bg-primary/35 hover:bg-primary/60',
                )}
                style={{ height: `${Math.max(4, (p.total / max) * alturaBarra)}px` }}
                title={`${rotuloMes(ym)}: ${formatBRL(p.total)}`}
              />
              <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                {ym.endsWith('-01') ? `${nome}/${ym.slice(2, 4)}` : nome}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
