'use client'

import { useEffect, useState } from 'react'
import type { Rates } from '@/server/fluxo/fluxo.calc'

// Cotações de fallback (se a API estiver fora, a tela não quebra).
const FALLBACK: Rates = { USD: 5.4, EUR: 5.9 }

// Busca USD-BRL e EUR-BRL ao vivo (AwesomeAPI, sem token). Usado pra converter
// lançamentos em moeda estrangeira pra real.
export function useRates(): Rates {
  const [rates, setRates] = useState<Rates>(FALLBACK)
  useEffect(() => {
    fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL')
      .then((r) => r.json())
      .then((d) => setRates({ USD: Number(d.USDBRL.bid), EUR: Number(d.EURBRL.bid) }))
      .catch(() => {})
  }, [])
  return rates
}
