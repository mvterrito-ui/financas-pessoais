import type { TipoGrupo } from '@/server/anual/anual.calc'

// Rótulo + estilo do selo de cada tipo de grupo (sempre com TEXTO, nunca só cor).
export const TIPOS: Record<TipoGrupo, { label: string; plural: string; selo: string }> = {
  receita: {
    label: 'Receita',
    plural: 'Receitas',
    selo: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  },
  investimento: {
    label: 'Investimento',
    plural: 'Investimentos',
    selo: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  },
  despesa: {
    label: 'Despesa',
    plural: 'Despesas',
    selo: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  },
}

export const OPCOES_TIPO = (Object.keys(TIPOS) as TipoGrupo[]).map((t) => ({
  value: t,
  label: TIPOS[t].label,
}))

export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
