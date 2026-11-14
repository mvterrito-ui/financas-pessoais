import { describe, it, expect } from 'vitest'
import {
  indexar,
  media,
  mesesDoAno,
  pctDaReceita,
  preencherAdiante,
  resumo,
  itemVisivel,
  aplicarFluxo,
  somarSeries,
  total,
  type Grupo,
  type Item,
} from './anual.calc'

const g = (id: string, tipo: Grupo['tipo']): Grupo => ({ id, name: id, tipo, descricao: null, ordem: 0 })
const it_ = (id: string, group_id: string): Item => ({
  id,
  group_id,
  category_id: null,
  name: id,
  ordem: 0,
  oculto: false,
})

describe('anual.calc', () => {
  it('mesesDoAno gera os 12 meses', () => {
    const m = mesesDoAno(2026)
    expect(m).toHaveLength(12)
    expect(m[0]).toBe('2026-01-01')
    expect(m[11]).toBe('2026-12-01')
  })

  it('somarSeries mantém mês vazio como vazio (≠ 0)', () => {
    expect(somarSeries([[1, undefined, 0], [2, undefined, undefined]], 3)).toEqual([3, undefined, 0])
  })

  it('média ignora meses vazios; total trata vazio como 0', () => {
    const s = [100, undefined, 300]
    expect(media(s)).toBe(200)
    expect(total(s)).toBe(400)
    expect(media([undefined])).toBeNull()
  })

  it('% da receita (null sem receita)', () => {
    expect(pctDaReceita(250, 1000)).toBe(25)
    expect(pctDaReceita(250, 0)).toBeNull()
    expect(pctDaReceita(undefined, 1000)).toBeNull()
  })

  it('preencherAdiante repete o último valor nos vazios seguintes', () => {
    expect(preencherAdiante([undefined, 100, undefined, 150, undefined])).toEqual([
      { indice: 2, valor: 100 },
      { indice: 4, valor: 150 },
    ])
    expect(preencherAdiante([undefined, undefined])).toEqual([])
  })

  it('item oculto só aparece se tiver valor no ano', () => {
    expect(itemVisivel({ oculto: true }, [undefined, undefined])).toBe(false)
    expect(itemVisivel({ oculto: true }, [undefined, 10])).toBe(true)
    expect(itemVisivel({ oculto: false }, [undefined])).toBe(true)
  })

  it('resumo: saldo = receita − investimento − despesa, por mês', () => {
    const grupos = [g('rec', 'receita'), g('inv', 'investimento'), g('fix', 'despesa'), g('var', 'despesa')]
    const itens = [it_('sal', 'rec'), it_('acoes', 'inv'), it_('aluguel', 'fix'), it_('luz', 'var')]
    const v = indexar([
      { item_id: 'sal', mes: '2026-01-01', valor: 5000 },
      { item_id: 'acoes', mes: '2026-01-01', valor: 500 },
      { item_id: 'aluguel', mes: '2026-01-01', valor: '1500' },
      { item_id: 'luz', mes: '2026-01-01', valor: 200 },
      { item_id: 'luz', mes: '2026-02-01', valor: 180 },
    ])
    const r = resumo(grupos, itens, v, 2026)
    expect(r.receita[0]).toBe(5000)
    expect(r.despesa[0]).toBe(1700)
    expect(r.saldo[0]).toBe(2800)
    expect(r.saldo[1]).toBe(-180) // fev: só despesa
    expect(r.saldo[2]).toBeUndefined() // mar: nada lançado
    expect(r.porGrupo.get('var')![1]).toBe(180)
  })
})

describe('aplicarFluxo (Fluxo de Caixa -> Controle Anual)', () => {
  const valores = indexar([
    { item_id: 'merc', mes: '2026-01-01', valor: 999 }, // digitado, mas o item está ligado
    { item_id: 'luz', mes: '2026-01-01', valor: 130 }, // manual, não ligado
  ])
  const fluxo = [
    { item_id: 'merc', mes: '2026-01-01', moeda: 'BRL', valor: 300 },
    { item_id: 'merc', mes: '2026-01-01', moeda: 'USD', valor: 10 },
    { item_id: 'merc', mes: '2026-02-01', moeda: 'BRL', valor: '250' },
  ]
  const emReal = (v: number, m: string) => (m === 'USD' ? v * 5 : v)

  it('item ligado usa só o Fluxo (convertido); o manual dos outros fica', () => {
    const r = aplicarFluxo(valores, fluxo, new Set(['merc']), emReal)
    expect(r.get('merc|2026-01-01')).toBe(350) // 300 + 10×5 (o 999 digitado não conta)
    expect(r.get('merc|2026-02-01')).toBe(250)
    expect(r.get('luz|2026-01-01')).toBe(130)
  })

  it('sem ligação, nada muda', () => {
    const r = aplicarFluxo(valores, fluxo, new Set(), emReal)
    expect(r.get('merc|2026-01-01')).toBe(999)
    expect(r.has('merc|2026-02-01')).toBe(false)
  })
})
