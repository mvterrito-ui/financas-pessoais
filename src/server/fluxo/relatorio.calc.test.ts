import { describe, expect, it } from 'vitest'
import { OUTROS, SEM_GRUPO, porMes, saidasPorGrupoMes, topoDoEixo, type Lanc } from './relatorio.calc'

const emReal = (v: number | string, m?: string | null) => Number(v) * (m === 'USD' ? 5 : 1)

describe('porMes', () => {
  it('soma entradas e saídas por mês e calcula o saldo', () => {
    const txs: Lanc[] = [
      { tipo: 'entrada', valor: 1000, data: '2026-01-05' },
      { tipo: 'saida', valor: '300', data: '2026-01-10' },
      { tipo: 'saida', valor: 10, moeda: 'USD', data: '2026-03-01' },
    ]
    const m = porMes(txs, emReal)
    expect(m[0]).toEqual({ entradas: 1000, saidas: 300, saldo: 700 })
    expect(m[2]).toEqual({ entradas: 0, saidas: 50, saldo: -50 })
    expect(m[11]).toEqual({ entradas: 0, saidas: 0, saldo: 0 })
  })
})

describe('saidasPorGrupoMes', () => {
  const grupoDoItem = new Map([
    ['aluguel', 'moradia'],
    ['mercado', 'casa'],
    ['cinema', 'lazer'],
  ])
  const txs: Lanc[] = [
    { tipo: 'saida', valor: 1000, data: '2026-01-10', item_id: 'aluguel' },
    { tipo: 'saida', valor: 1000, data: '2026-02-10', item_id: 'aluguel' },
    { tipo: 'saida', valor: 500, data: '2026-01-15', item_id: 'mercado' },
    { tipo: 'saida', valor: 80, data: '2026-02-20', item_id: 'cinema' },
    { tipo: 'saida', valor: 40, data: '2026-02-21', item_id: null },
    { tipo: 'entrada', valor: 9999, data: '2026-01-05', item_id: null },
  ]

  it('ordena pelo total do ano e junta o resto em Outros', () => {
    const r = saidasPorGrupoMes(txs, grupoDoItem, emReal, 2)
    expect(r.map((g) => g.id)).toEqual(['moradia', 'casa', OUTROS])
    expect(r[0].serie.slice(0, 2)).toEqual([1000, 1000])
    expect(r[2].total).toBe(120) // lazer 80 + sem categoria 40
  })

  it('sem categoria vira um grupo próprio quando está entre os maiores', () => {
    const r = saidasPorGrupoMes(txs, grupoDoItem, emReal, 10)
    expect(r.map((g) => g.id)).toEqual(['moradia', 'casa', 'lazer', SEM_GRUPO])
  })
})

describe('topoDoEixo', () => {
  it('arredonda pra cima num valor redondo', () => {
    expect(topoDoEixo(0)).toBe(1)
    expect(topoDoEixo(830)).toBe(1000)
    expect(topoDoEixo(1200)).toBe(1500)
    expect(topoDoEixo(13200)).toBe(15000)
    expect(topoDoEixo(2100)).toBe(2500)
    expect(topoDoEixo(3700)).toBe(4000)
    expect(topoDoEixo(4600)).toBe(5000)
    expect(topoDoEixo(5000)).toBe(5000)
  })
})
