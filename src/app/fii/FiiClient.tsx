'use client'

import { Building2 } from 'lucide-react'
import { CarteiraTickers } from '@/components/shared/CarteiraTickers'

export default function FiiClient() {
  return (
    <CarteiraTickers
      config={{
        api: '/api/fii',
        titulo: 'FIIs',
        descricao: 'Seus fundos imobiliários (cotação ao vivo)',
        icon: Building2,
        nome: 'FII',
        novoLabel: 'Novo FII',
        vazioTitulo: 'Nenhum FII ainda',
        vazioDescricao: 'Adicione seus fundos imobiliários (ticker, cotas e preço médio).',
        tickerExemplo: 'BTLG11',
        qtdLabel: 'Quantas cotas?',
        tipoAtivo: 'fii',
      }}
    />
  )
}
