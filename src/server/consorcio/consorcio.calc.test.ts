import { describe, it, expect } from 'vitest'
import { faixasDeParcela, faltaPagar, faltamParcelas, pagoEstimado, parcelaAtual, pctQuitado, totais, valorDaParcela, type Consorcio } from './consorcio.calc'

const c = (o: Partial<Consorcio> = {}): Consorcio => ({
  id: '1',
  nome: 'Carro',
  administradora: null,
  tipo: 'veiculo',
  valor_carta: 60000,
  prazo_meses: 80,
  parcelas_pagas: 20,
  valor_parcela: 850,
  status: 'ativo',
  ...o,
})

describe('consorcio.calc', () => {
  it('parcelas, % quitado, pago e falta pagar', () => {
    expect(faltamParcelas(c())).toBe(60)
    expect(pctQuitado(c())).toBe(25)
    expect(pagoEstimado(c())).toBe(17000)
    expect(faltaPagar(c())).toBe(51000)
  })

  it('encerrado não tem nada a pagar; quitado não está em andamento', () => {
    expect(faltaPagar(c({ status: 'encerrado' }))).toBe(0)
    const t = totais([c({ parcelas_pagas: 80 }), c({ id: '2', valor_parcela: '500' })])
    expect(t.emAndamento).toBe(1)
    expect(t.parcelaMensal).toBe(500)
  })

  it('totais somam cartas (sem encerrados), pago e falta', () => {
    const t = totais([c(), c({ id: '2', status: 'contemplado' }), c({ id: '3', status: 'encerrado' })])
    expect(t.cartas).toBe(120000)
    expect(t.contemplados).toBe(1)
    expect(t.falta).toBe(102000)
  })
})

describe('consorcio: reajustes da parcela', () => {
  // 10 parcelas: 1–4 a 100, reajuste a partir da 5ª pra 110, da 9ª pra 120
  const base = c({ prazo_meses: 10, parcelas_pagas: 6, valor_parcela: 100 })
  const rj = [
    { id: 'r2', consorcio_id: '1', a_partir_parcela: 9, valor_parcela: 120 },
    { id: 'r1', consorcio_id: '1', a_partir_parcela: 5, valor_parcela: '110' },
    { id: 'x', consorcio_id: 'outro', a_partir_parcela: 2, valor_parcela: 999 },
  ]

  it('valor de cada parcela segue o último reajuste que já vale', () => {
    expect(valorDaParcela(base, rj, 1)).toBe(100)
    expect(valorDaParcela(base, rj, 4)).toBe(100)
    expect(valorDaParcela(base, rj, 5)).toBe(110)
    expect(valorDaParcela(base, rj, 10)).toBe(120)
  })

  it('pago soma cada parcela pelo valor da época; falta usa vigente + futuros', () => {
    expect(pagoEstimado(base, rj)).toBe(4 * 100 + 2 * 110) // 620
    expect(faltaPagar(base, rj)).toBe(2 * 110 + 2 * 120) // 7ª,8ª a 110; 9ª,10ª a 120
    expect(parcelaAtual(base, rj)).toBe(110) // próxima = 7ª
  })

  it('faixas pra exibir o histórico, com % de variação', () => {
    const f = faixasDeParcela(base, rj)
    expect(f.map((x) => [x.de, x.ate, x.valor])).toEqual([
      [1, 4, 100],
      [5, 8, 110],
      [9, null, 120],
    ])
    expect(f[1].variacaoPct).toBeCloseTo(10)
  })

  it('totais usam a parcela ATUAL (com reajuste) no mensal', () => {
    expect(totais([base], rj).parcelaMensal).toBe(110)
  })
})
