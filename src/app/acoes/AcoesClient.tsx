'use client'

import { CandlestickChart } from 'lucide-react'
import { CarteiraTickers } from '@/components/shared/CarteiraTickers'

export default function AcoesClient() {
  return (
    <CarteiraTickers
      config={{
        api: '/api/acao',
        titulo: 'Ações',
        descricao: 'Suas ações da B3 (cotação ao vivo)',
        icon: CandlestickChart,
        emoji: '📊',
        nome: 'ação',
        novoLabel: 'Nova ação',
        vazioTitulo: 'Nenhuma ação ainda',
        vazioDescricao: 'Adicione suas ações (ticker, quantidade e preço médio).',
        tickerExemplo: 'PETR4',
        qtdLabel: 'Quantas ações?',
      }}
    />
  )
}
