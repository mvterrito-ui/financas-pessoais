import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Junta classes Tailwind com segurança (resolve conflitos, ex: 'p-2' + 'p-4').
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Data de HOJE no horário de Brasília ('AAAA-MM-DD'). Antes usava UTC: depois
// das 21h já virava amanhã (e no último dia do mês, o mês seguinte).
export const hojeISO = (agora = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)

// '2026-06-09' -> '09/06/2026'
export function formatData(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

// '2026-02' -> '2026-02-28' (último dia do mês)
export function fimDoMes(ym: string) {
  const [a, m] = ym.split('-').map(Number)
  const dia = new Date(a, m, 0).getDate()
  return `${ym}-${String(dia).padStart(2, '0')}`
}

const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
// '2026-02' -> 'fev/2026'
export function rotuloMes(ym: string) {
  const [a, m] = ym.split('-')
  return `${MESES_PT[Number(m) - 1]}/${a}`
}

// '2026-03' -> '2026-02' (mês anterior)
export function mesAnterior(ym: string) {
  const [a, m] = ym.split('-').map(Number)
  const d = new Date(a, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
