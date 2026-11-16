import { describe, it, expect } from 'vitest'
import {
  aconteceEm,
  dataNoMes,
  planejadoDoAno,
  previstosDoMes,
  proximaOcorrencia,
  statusEm,
  valorNoMes,
  type Recorrencia,
} from './recorrencia.calc'

const r = (o: Partial<Recorrencia> = {}): Recorrencia => ({
  id: 'r1',
  tipo: 'saida',
  descricao: 'Aluguel',
  valor: 2000,
  moeda: 'BRL',
  item_id: 'aluguel',
  account_id: null,
  dia: 31,
  inicio: '2026-01-01',
  fim: null,
  ...o,
})

describe('recorrencia.calc', () => {
  it('data no mês respeita o último dia (31 -> 28/fev)', () => {
    expect(dataNoMes(r(), '2026-02-01')).toBe('2026-02-28')
    expect(dataNoMes(r({ dia: 5 }), '2026-03-01')).toBe('2026-03-05')
  })

  it('acontece só entre início e fim, fora das pausas', () => {
    const pausas = [{ id: 'p', recorrencia_id: 'r1', de: '2026-04-01', ate: '2026-05-01' }]
    const rec = r({ fim: '2026-08-01' })
    expect(aconteceEm(rec, pausas, '2025-12-01')).toBe(false)
    expect(aconteceEm(rec, pausas, '2026-03-01')).toBe(true)
    expect(aconteceEm(rec, pausas, '2026-04-01')).toBe(false)
    expect(aconteceEm(rec, pausas, '2026-06-01')).toBe(true)
    expect(aconteceEm(rec, pausas, '2026-09-01')).toBe(false)
  })

  it('status: ativa, pausada (pausa aberta), finalizada, futura', () => {
    const aberta = [{ id: 'p', recorrencia_id: 'r1', de: '2026-10-01', ate: null }]
    expect(statusEm(r(), [], '2026-11-01')).toBe('ativa')
    expect(statusEm(r(), aberta, '2026-11-01')).toBe('pausada')
    expect(statusEm(r({ fim: '2026-10-01' }), [], '2026-11-01')).toBe('finalizada')
    expect(statusEm(r({ inicio: '2027-01-01' }), [], '2026-11-01')).toBe('futura')
  })

  it('valor segue o último reajuste já vigente', () => {
    const aj = [{ id: 'a', recorrencia_id: 'r1', a_partir: '2026-07-01', valor: '2150' }]
    expect(valorNoMes(r(), aj, '2026-06-01')).toBe(2000)
    expect(valorNoMes(r(), aj, '2026-07-01')).toBe(2150)
  })

  it('previstos do mês marcam o que já foi confirmado', () => {
    const recs = [r(), r({ id: 'r2', descricao: 'Academia', dia: 10, valor: 120 })]
    const p = previstosDoMes(recs, [], [], [{ recorrencia_id: 'r1', competencia: '2026-11-01' }], '2026-11-01')
    expect(p.map((x) => [x.recorrencia.id, x.data, x.confirmada])).toEqual([
      ['r2', '2026-11-10', false],
      ['r1', '2026-11-30', true],
    ])
  })

  it('planejado do ano soma por categoria e mês, pulando pausas', () => {
    const pausas = [{ id: 'p', recorrencia_id: 'r1', de: '2026-02-01', ate: '2026-02-01' }]
    const pl = planejadoDoAno([r({ fim: '2026-03-01' })], pausas, [], 2026)
    expect(pl.map((x) => x.mes)).toEqual(['2026-01-01', '2026-03-01'])
  })

  it('próxima ocorrência pula pausa e respeita o fim', () => {
    const aberta = [{ id: 'p', recorrencia_id: 'r1', de: '2026-11-01', ate: '2026-12-01' }]
    expect(proximaOcorrencia(r(), aberta, '2026-11-01')).toBe('2027-01-31')
    expect(proximaOcorrencia(r({ fim: '2026-10-01' }), [], '2026-11-01')).toBeNull()
  })
})
