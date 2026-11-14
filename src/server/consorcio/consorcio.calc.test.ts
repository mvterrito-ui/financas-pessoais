import { describe, it, expect } from 'vitest'
import { faltaPagar, faltamParcelas, pagoEstimado, pctQuitado, totais, type Consorcio } from './consorcio.calc'

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
