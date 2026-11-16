'use client'

import { Select } from '@/components/ui/select'
import type { Categoria, Grupo, Item } from '@/server/anual/anual.calc'

export type Plano = { grupos: Grupo[]; categorias: Categoria[]; itens: Item[] }

/** Entrada usa grupos de receita; saída, de despesa e investimento. */
export const gruposDoTipo = (grupos: Grupo[], tipo: 'entrada' | 'saida') =>
  grupos.filter((g) => (tipo === 'entrada' ? g.tipo === 'receita' : g.tipo !== 'receita'))

/** Nome da categoria com o subgrupo, se houver ("Moradia · Aluguel"). */
export function nomeCategoria(plano: Plano, itemId: string | null | undefined): string | null {
  const item = plano.itens.find((i) => i.id === itemId)
  if (!item) return null
  const sub = plano.categorias.find((c) => c.id === item.category_id)
  return sub ? `${sub.name} · ${item.name}` : item.name
}

/** Seletor de categoria do plano de contas, agrupado por grupo. */
export function CategoriaSelect({
  plano,
  tipo,
  value,
  onChange,
  id,
  vazio = 'Sem categoria',
}: {
  plano: Plano
  tipo: 'entrada' | 'saida'
  value: string
  onChange: (itemId: string) => void
  id?: string
  vazio?: string
}) {
  const grupos = gruposDoTipo(plano.grupos, tipo)
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{vazio}</option>
      {grupos.map((g) => {
        const itens = plano.itens.filter((i) => i.group_id === g.id && (!i.oculto || i.id === value))
        if (itens.length === 0) return null
        return (
          <optgroup key={g.id} label={g.name}>
            {itens.map((i) => (
              <option key={i.id} value={i.id}>
                {nomeCategoria(plano, i.id)}
              </option>
            ))}
          </optgroup>
        )
      })}
    </Select>
  )
}
