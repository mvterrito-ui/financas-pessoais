'use client'

import { Fragment, useState, type ReactNode } from 'react'
import {
  ChevronRight,
  Eye,
  EyeOff,
  FolderPlus,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  MoreHorizontal,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { MoneyCommit } from '@/components/ui/money-input'
import { cn } from '@/lib/utils'
import {
  itemVisivel,
  media,
  pctDaReceita,
  serieDoItem,
  total,
  type Categoria,
  type Grupo,
  type Item,
  type Serie,
  type Valores,
  type resumo as resumoFn,
} from '@/server/anual/anual.calc'
import { MESES_CURTOS, TIPOS } from './tipos'

type Resumo = ReturnType<typeof resumoFn>

const fmt = (v: number | null | undefined) =>
  v === null || v === undefined
    ? '—'
    : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPct = (p: number | null) =>
  p === null ? '—' : `${p.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

// Larguras: 1ª coluna fixa (sticky) + 12 meses + Total + Média.
// No celular a 1ª coluna é mais estreita pra sobrar espaço pros meses.
const COL_NOME = 'sticky left-0 z-10 w-40 min-w-40 max-w-40 bg-card sm:w-60 sm:min-w-60 sm:max-w-60'
const COL_MES = 'w-32 min-w-32 px-1.5'
// border-separate (necessário pro sticky) ignora borda em <tr>: vai em cada <td>.
const LINHA = 'border-t border-border'

function BotaoIcone({
  titulo,
  onClick,
  perigo,
  children,
}: {
  titulo: string
  onClick: () => void
  perigo?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors',
        perigo ? 'hover:bg-destructive/10 hover:text-destructive' : 'hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

// Ações que aparecem ao passar o mouse na linha (sempre visíveis no celular).
// No desktop ficam FORA do fluxo até o hover (não roubam espaço do nome).
const ACOES_DESKTOP = 'desk:hidden desk:group-hover/linha:flex desk:group-focus-within/linha:flex'

/**
 * Ações da linha. Desktop: aparecem no hover. Celular (sem hover): botão "⋯"
 * abre uma barrinha flutuante com os botões; tocar em uma ação fecha.
 */
function Acoes({
  aberto,
  onAlternar,
  children,
}: {
  aberto: boolean
  onAlternar: () => void
  children: ReactNode
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Ações"
        aria-expanded={aberto}
        onClick={onAlternar}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted desk:hidden"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <div
        onClick={() => aberto && onAlternar()}
        className={cn(
          'shrink-0 items-center',
          aberto
            ? 'absolute right-9 top-1/2 z-30 flex -translate-y-1/2 rounded-lg border border-border bg-card p-0.5 shadow-lg desk:static desk:translate-y-0 desk:border-0 desk:p-0 desk:shadow-none'
            : 'hidden',
          ACOES_DESKTOP,
        )}
      >
        {children}
      </div>
    </>
  )
}

export function GradeAnual(props: {
  mesDestaque: number | null
  grupos: Grupo[]
  categorias: Categoria[]
  itens: Item[]
  valores: Valores
  resumo: Resumo
  onSalvar: (itemId: string, mes: string, valor: string) => void
  onRepetir: (item: Item) => void
  onEditarItem: (item: Item) => void
  onOcultarItem: (item: Item, oculto: boolean) => void
  onRemoverItem: (item: Item) => void
  onNovoItem: (g: Grupo, categoriaId?: string | null) => void
  onNovaCategoria: (g: Grupo) => void
  onEditarCategoria: (c: Categoria) => void
  onRemoverCategoria: (c: Categoria) => void
  onEditarGrupo: (g: Grupo) => void
  onRemoverGrupo: (g: Grupo) => void
}) {
  const { mesDestaque, grupos, categorias, itens, valores, resumo: r } = props
  const [fechados, setFechados] = useState<Set<string>>(new Set())
  const [verOcultos, setVerOcultos] = useState<Set<string>>(new Set())
  // Celular: qual linha está com o menu "⋯" aberto.
  const [menu, setMenu] = useState<string | null>(null)
  const alternarMenu = (id: string) => () => setMenu((m) => (m === id ? null : id))
  const alternar = (set: Set<string>, id: string) => {
    const novo = new Set(set)
    if (novo.has(id)) novo.delete(id)
    else novo.add(id)
    return novo
  }

  const destaque = (i: number) => i === mesDestaque && 'bg-primary/[0.04]'

  // Linha de números (totais/resumo): 12 meses + total + média.
  const celulasNumero = (
    s: Serie,
    classe?: (v: number | undefined) => string,
    comMedia = true,
    extra?: string,
  ) => (
    <>
      {s.map((v, i) => (
        <td key={i} className={cn(COL_MES, 'py-2 text-right tabular-nums', extra, destaque(i), classe?.(v))}>
          {fmt(v)}
        </td>
      ))}
      <td className={cn('px-3 py-2 text-right tabular-nums', extra, classe?.(total(s)))}>{fmt(total(s))}</td>
      <td className={cn('px-3 py-2 text-right tabular-nums text-muted-foreground', extra)}>
        {comMedia ? fmt(media(s)) : ''}
      </td>
    </>
  )

  function linhaItem(item: Item, serie: Serie, recuo: boolean) {
    return (
      <tr key={item.id} className="group/linha">
        <td className={cn(COL_NOME, LINHA, 'py-1.5 pr-1', recuo ? 'pl-8' : 'pl-4')}>
          <div className="flex items-center gap-1">
            <span
              className={cn('min-w-0 flex-1 truncate', item.oculto && 'text-muted-foreground')}
              title={item.name}
            >
              {item.oculto && <EyeOff className="mr-1 inline h-3 w-3" />}
              {item.name}
            </span>
            <Acoes aberto={menu === `i-${item.id}`} onAlternar={alternarMenu(`i-${item.id}`)}>
              <BotaoIcone titulo="Repetir nos meses seguintes (preenche os vazios)" onClick={() => props.onRepetir(item)}>
                <Repeat className="h-3.5 w-3.5" />
              </BotaoIcone>
              <BotaoIcone titulo="Editar" onClick={() => props.onEditarItem(item)}>
                <Pencil className="h-3.5 w-3.5" />
              </BotaoIcone>
              {item.oculto ? (
                <BotaoIcone titulo="Mostrar de novo" onClick={() => props.onOcultarItem(item, false)}>
                  <Eye className="h-3.5 w-3.5" />
                </BotaoIcone>
              ) : (
                <BotaoIcone titulo="Ocultar (mantém o histórico)" onClick={() => props.onOcultarItem(item, true)}>
                  <EyeOff className="h-3.5 w-3.5" />
                </BotaoIcone>
              )}
              <BotaoIcone titulo="Remover (apaga do histórico)" perigo onClick={() => props.onRemoverItem(item)}>
                <Trash2 className="h-3.5 w-3.5" />
              </BotaoIcone>
            </Acoes>
          </div>
        </td>
        {r.meses.map((mes, i) => (
          <td key={mes} className={cn(COL_MES, LINHA, 'py-1', destaque(i))}>
            <MoneyCommit
              aria-label={`${item.name} em ${MESES_CURTOS[i]}`}
              placeholder="—"
              inicial={serie[i] ?? ''}
              onCommit={(v) => props.onSalvar(item.id, mes, v)}
            />
          </td>
        ))}
        <td className={cn(LINHA, 'px-3 py-1.5 text-right font-medium tabular-nums')}>{fmt(total(serie))}</td>
        <td className={cn(LINHA, 'px-3 py-1.5 text-right tabular-nums text-muted-foreground')}>
          {fmt(media(serie))}
        </td>
      </tr>
    )
  }

  return (
    <Card className="mb-5 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-xs font-medium text-muted-foreground">
              <th className={cn(COL_NOME, 'z-20 border-b border-border bg-muted/40 px-4 py-2.5 text-left')}>
                <span className="block bg-transparent">Item</span>
              </th>
              {MESES_CURTOS.map((m, i) => (
                <th
                  key={m}
                  className={cn(
                    COL_MES,
                    'border-b border-border bg-muted/40 py-2.5 pr-3 text-right',
                    i === mesDestaque && 'bg-primary/10 text-primary',
                  )}
                >
                  {m}
                </th>
              ))}
              <th className="min-w-28 border-b border-border bg-muted/40 px-3 py-2.5 text-right">Total</th>
              <th className="min-w-28 border-b border-border bg-muted/40 px-3 py-2.5 text-right">Média</th>
            </tr>
          </thead>

          {grupos.map((g) => {
            const tipo = TIPOS[g.tipo]
            const aberto = !fechados.has(g.id)
            const doGrupo = itens.filter((i) => i.group_id === g.id)
            const series = new Map(doGrupo.map((i) => [i.id, serieDoItem(i.id, r.meses, valores)]))
            const mostrarOcultos = verOcultos.has(g.id)
            const visiveis = doGrupo.filter((i) => mostrarOcultos || itemVisivel(i, series.get(i.id)!))
            const qtdOcultos = doGrupo.length - doGrupo.filter((i) => itemVisivel(i, series.get(i.id)!)).length
            const cats = categorias.filter((c) => c.group_id === g.id)
            const soltos = visiveis.filter((i) => !i.category_id || !cats.some((c) => c.id === i.category_id))
            const totalGrupo = r.porGrupo.get(g.id) ?? []

            return (
              <tbody key={g.id}>
                {/* Cabeçalho do grupo */}
                <tr className="group/linha">
                  <td className={cn(COL_NOME, 'border-t-4 border-background px-2 py-2.5')}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setFechados((s) => alternar(s, g.id))}
                        aria-expanded={aberto}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                        title={g.descricao ?? g.name}
                      >
                        <ChevronRight
                          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', aberto && 'rotate-90')}
                        />
                        <span className="truncate font-semibold">{g.name}</span>
                      </button>
                      <Acoes aberto={menu === `g-${g.id}`} onAlternar={alternarMenu(`g-${g.id}`)}>
                        <BotaoIcone titulo="Novo item" onClick={() => props.onNovoItem(g)}>
                          <Plus className="h-3.5 w-3.5" />
                        </BotaoIcone>
                        <BotaoIcone titulo="Nova categoria" onClick={() => props.onNovaCategoria(g)}>
                          <FolderPlus className="h-3.5 w-3.5" />
                        </BotaoIcone>
                        <BotaoIcone titulo="Editar grupo" onClick={() => props.onEditarGrupo(g)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </BotaoIcone>
                        <BotaoIcone titulo="Remover grupo" perigo onClick={() => props.onRemoverGrupo(g)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </BotaoIcone>
                      </Acoes>
                    </div>
                  </td>
                  <td colSpan={14} className="border-t-4 border-background px-3 py-2.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={cn('rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset', tipo.selo)}>
                        {tipo.label}
                      </span>
                      {g.descricao && <span className="truncate text-muted-foreground">{g.descricao}</span>}
                      {qtdOcultos > 0 && (
                        <button
                          type="button"
                          onClick={() => setVerOcultos((s) => alternar(s, g.id))}
                          className="ml-2 flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <EyeOff className="h-3 w-3" />
                          {mostrarOcultos ? 'Esconder ocultos' : `${qtdOcultos} oculto${qtdOcultos > 1 ? 's' : ''}`}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {aberto && (
                  <>
                    {doGrupo.length === 0 && (
                      <tr>
                        <td colSpan={15} className={cn(LINHA, 'px-4 py-3 text-sm text-muted-foreground')}>
                          <button
                            type="button"
                            onClick={() => props.onNovoItem(g)}
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                          >
                            <Plus className="h-3.5 w-3.5" /> Adicionar o primeiro item
                          </button>
                        </td>
                      </tr>
                    )}

                    {soltos.map((i) => linhaItem(i, series.get(i.id)!, false))}

                    {cats.map((c) => {
                      const daCat = visiveis.filter((i) => i.category_id === c.id)
                      return (
                        <Fragment key={c.id}>
                          <tr className="group/linha">
                            <td className={cn(COL_NOME, LINHA, 'bg-muted/30 py-1.5 pl-4 pr-1')}>
                              <div className="flex items-center gap-1">
                                <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {c.name}
                                </span>
                                <Acoes aberto={menu === `c-${c.id}`} onAlternar={alternarMenu(`c-${c.id}`)}>
                                  <BotaoIcone titulo={`Novo item em ${c.name}`} onClick={() => props.onNovoItem(g, c.id)}>
                                    <Plus className="h-3.5 w-3.5" />
                                  </BotaoIcone>
                                  <BotaoIcone titulo="Renomear categoria" onClick={() => props.onEditarCategoria(c)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </BotaoIcone>
                                  <BotaoIcone titulo="Remover categoria" perigo onClick={() => props.onRemoverCategoria(c)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </BotaoIcone>
                                </Acoes>
                              </div>
                            </td>
                            <td colSpan={14} className={cn(LINHA, 'bg-muted/30')} />
                          </tr>
                          {daCat.map((i) => linhaItem(i, series.get(i.id)!, true))}
                        </Fragment>
                      )
                    })}
                  </>
                )}

                {/* Total do grupo + % da receita */}
                <tr className="bg-muted font-semibold">
                  <td className={cn(COL_NOME, LINHA, 'bg-muted px-4 py-2')}>
                    <span className="block truncate" title={`Total ${g.name}`}>
                      Total {g.name}
                    </span>
                  </td>
                  {celulasNumero(totalGrupo, undefined, true, LINHA)}
                </tr>
                {g.tipo !== 'receita' && (
                  <tr className="text-xs text-muted-foreground">
                    <td className={cn(COL_NOME, 'px-4 py-1.5')}>% da receita</td>
                    {totalGrupo.map((v, i) => (
                      <td key={i} className={cn(COL_MES, 'py-1.5 text-right tabular-nums', destaque(i))}>
                        {fmtPct(pctDaReceita(v, r.receita[i]))}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {fmtPct(pctDaReceita(total(totalGrupo), total(r.receita)))}
                    </td>
                    <td />
                  </tr>
                )}
              </tbody>
            )
          })}

          {/* Resumo: receita − investimentos − despesas = saldo */}
          <tbody>
            <tr>
              <td className={cn(COL_NOME, 'border-t-4 border-background px-4 pb-1 pt-4')}>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumo</span>
              </td>
              <td colSpan={14} className="border-t-4 border-background" />
            </tr>
            {grupos.map((g) => (
              <tr key={g.id}>
                <td className={cn(COL_NOME, LINHA, 'px-4 py-2')}>
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">{g.tipo === 'receita' ? '+' : '−'}</span>
                    <span className="truncate">{g.name}</span>
                  </span>
                </td>
                {celulasNumero(r.porGrupo.get(g.id) ?? [], undefined, true, LINHA)}
              </tr>
            ))}
            <tr className="text-base font-bold">
              <td className={cn(COL_NOME, 'border-t-2 border-foreground/20 bg-muted px-4 py-2.5')}>= Saldo</td>
              {r.saldo.map((v, i) => (
                <td
                  key={i}
                  className={cn(
                    COL_MES,
                    'border-t-2 border-foreground/20 bg-muted py-2.5 text-right tabular-nums',
                    v !== undefined && (v >= 0 ? 'text-success' : 'text-destructive'),
                  )}
                >
                  {fmt(v)}
                </td>
              ))}
              <td
                className={cn(
                  'border-t-2 border-foreground/20 bg-muted px-3 py-2.5 text-right tabular-nums',
                  total(r.saldo) >= 0 ? 'text-success' : 'text-destructive',
                )}
              >
                {fmt(total(r.saldo))}
              </td>
              <td className="border-t-2 border-foreground/20 bg-muted px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {fmt(media(r.saldo))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}
