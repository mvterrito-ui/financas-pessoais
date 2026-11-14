'use client'

import { useState } from 'react'
import { Link2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import type { Item, TipoGrupo } from '@/server/anual/anual.calc'

export type CategoriaFluxo = {
  id: string
  name: string
  tipo: 'entrada' | 'saida'
  annual_item_id: string | null
}

/** Receita recebe categorias de ENTRADA; despesa/investimento, de SAÍDA. */
export const tipoFluxoDoGrupo = (t: TipoGrupo) => (t === 'receita' ? 'entrada' : 'saida')

/**
 * Escolhe quais categorias do Fluxo alimentam este item. Uma categoria só
 * pode estar em UM item (marcar aqui tira de onde estava) — assim nenhum
 * lançamento é contado duas vezes.
 */
export function LigarFluxoDialog({
  item,
  tipoGrupo,
  categorias,
  itens,
  onClose,
  onSalvar,
}: {
  item: Item
  tipoGrupo: TipoGrupo
  categorias: CategoriaFluxo[]
  itens: Item[]
  onClose: () => void
  onSalvar: (ligar: string[], desligar: string[]) => Promise<void>
}) {
  const tipo = tipoFluxoDoGrupo(tipoGrupo)
  const doTipo = categorias.filter((c) => c.tipo === tipo).sort((a, b) => a.name.localeCompare(b.name))
  const [marcadas, setMarcadas] = useState(
    () => new Set(categorias.filter((c) => c.annual_item_id === item.id).map((c) => c.id)),
  )
  const [salvando, setSalvando] = useState(false)
  const nomeItem = (id: string | null) => itens.find((i) => i.id === id)?.name

  async function salvar() {
    const ligar = doTipo.filter((c) => marcadas.has(c.id) && c.annual_item_id !== item.id).map((c) => c.id)
    const desligar = doTipo.filter((c) => !marcadas.has(c.id) && c.annual_item_id === item.id).map((c) => c.id)
    setSalvando(true)
    try {
      await onSalvar(ligar, desligar)
      onClose()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Ligar "${item.name}" ao Fluxo`}>
      <p className="mb-4 text-sm text-muted-foreground">
        Marque as categorias de <strong>{tipo === 'entrada' ? 'entrada' : 'saída'}</strong> do Fluxo de Caixa
        que formam este item. Cada mês passa a ser a soma desses lançamentos.
      </p>

      {doTipo.length === 0 ? (
        <p className="rounded-xl bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">
          Nenhuma categoria de {tipo === 'entrada' ? 'entrada' : 'saída'} no Fluxo ainda. Crie no Fluxo de
          Caixa e volte aqui.
        </p>
      ) : (
        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {doTipo.map((c) => {
            const emOutro = c.annual_item_id && c.annual_item_id !== item.id ? nomeItem(c.annual_item_id) : null
            return (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--color-primary)]"
                    checked={marcadas.has(c.id)}
                    onChange={(e) =>
                      setMarcadas((s) => {
                        const n = new Set(s)
                        if (e.target.checked) n.add(c.id)
                        else n.delete(c.id)
                        return n
                      })
                    }
                  />
                  <span className="flex-1">{c.name}</span>
                  {emOutro && (
                    <span className="text-xs text-muted-foreground" title="Marcar aqui tira de lá">
                      hoje em: {emOutro}
                    </span>
                  )}
                </label>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" onClick={salvar} disabled={salvando || doTipo.length === 0}>
          <Link2 /> {salvando ? 'Salvando…' : 'Salvar ligação'}
        </Button>
      </div>
    </Modal>
  )
}
