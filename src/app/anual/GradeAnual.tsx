'use client'

import { Fragment, useState, type ReactNode } from 'react'
import {
  ChevronRight,
  Eye,
  EyeOff,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  Target,
  Trash2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { MoneyCommit } from '@/components/ui/money-input'
import { cn } from '@/lib/utils'
import {
  desvio,
  metaFora,
  textoMeta,
  itemVisivel,
  media,
  pctDaReceita,
  serieDoItem,
  total,
  type Categoria,
  type Grupo,
  type Item,
  type Serie,
  type TipoGrupo,
  type Valores,
  type resumo as resumoFn,
} from '@/server/anual/anual.calc'
import { MESES_CURTOS, TIPOS } from './tipos'

type Resumo = ReturnType<typeof resumoFn>
export type ModoGrade = 'comparar' | 'realizado' | 'planejado'

const fmt = (v: number | null | undefined) =>
  v === null || v === undefined
    ? '—'
    : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtCurto = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
const fmtPct = (p: number | null) =>
  p === null ? '—' : `${p.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

// Larguras: 1ª coluna fixa (mais estreita no celular) + 12 meses + Total + Média.
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

const ACOES_DESKTOP = 'desk:hidden desk:group-hover/linha:flex desk:group-focus-within/linha:flex'

// Ações da linha. Desktop com mouse: aparecem no hover. Toque: botão "⋯".
function Acoes({ aberto, onAlternar, children }: { aberto: boolean; onAlternar: () => void; children: ReactNode }) {
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
  modo: ModoGrade
  mesDestaque: number | null
  grupos: Grupo[]
  categorias: Categoria[]
  itens: Item[]
  /** Soma dos lançamentos (em real). */
  realizado: Valores
  /** Planejado efetivo: digitado, senão o das recorrências. */
  plano: Valores
  /** Só o planejado digitado (o que a célula edita no modo Planejado). */
  manual: Valores
  /** O que as recorrências preveem (sugestão no modo Planejado). */
  recorrente: Valores
  resumoReal: Resumo
  resumoPlano: Resumo
  onSalvar: (itemId: string, mes: string, valor: string) => void
  onRepetir: (item: Item) => void
  onEditarItem: (item: Item) => void
  onOcultarItem: (item: Item, oculto: boolean) => void
  onRemoverItem: (item: Item) => void
  onNovoItem: (g: Grupo, subgrupoId?: string | null) => void
  onNovaCategoria: (g: Grupo) => void
  onEditarCategoria: (c: Categoria) => void
  onRemoverCategoria: (c: Categoria) => void
  onEditarGrupo: (g: Grupo) => void
  onRemoverGrupo: (g: Grupo) => void
}) {
  const { modo, mesDestaque, grupos, categorias, itens, resumoReal, resumoPlano } = props
  const meses = resumoReal.meses
  const [fechados, setFechados] = useState<Set<string>>(new Set())
  const [verOcultos, setVerOcultos] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<string | null>(null)
  const alternarMenu = (id: string) => () => setMenu((m) => (m === id ? null : id))
  const alternar = (set: Set<string>, id: string) => {
    const novo = new Set(set)
    if (novo.has(id)) novo.delete(id)
    else novo.add(id)
    return novo
  }

  const destaque = (i: number) => i === mesDestaque && 'bg-primary/[0.04]'
  // Totais exibidos: planejado no modo Planejado; realizado nos outros.
  const rExibido = modo === 'planejado' ? resumoPlano : resumoReal

  // Célula de número com, no modo Comparar, o planejado embaixo (colorido pelo desvio).
  function celulaComparada(tipo: TipoGrupo, real: number | undefined, plano: number | undefined, forte = false) {
    const d = desvio(tipo, real ?? (plano !== undefined ? 0 : undefined), plano)
    return (
      <div className="flex flex-col items-end leading-tight">
        <span className={cn('tabular-nums', forte && 'font-semibold', real === undefined && 'text-muted-foreground/60')}>
          {fmt(real)}
        </span>
        {modo === 'comparar' && plano !== undefined && (
          <span
            className={cn('text-[10px] tabular-nums', d?.ruim ? 'text-destructive' : 'text-muted-foreground')}
            title={d ? `Planejado ${fmt(plano)} · diferença ${fmt(d.diferenca)}` : undefined}
          >
            de {fmtCurto(plano)}
          </span>
        )}
      </div>
    )
  }

  function linhaItem(item: Item, tipo: TipoGrupo, recuo: boolean) {
    const real = serieDoItem(item.id, meses, props.realizado)
    const plano = serieDoItem(item.id, meses, props.plano)
    const exibida = modo === 'planejado' ? plano : real
    return (
      <tr key={item.id} className="group/linha">
        <td className={cn(COL_NOME, LINHA, 'py-1.5 pr-1', recuo ? 'pl-8' : 'pl-4')}>
          <div className="flex items-center gap-1">
            <span className={cn('min-w-0 flex-1 truncate', item.oculto && 'text-muted-foreground')} title={item.name}>
              {item.oculto && <EyeOff className="mr-1 inline h-3 w-3" />}
              {item.name}
            </span>
            <Acoes aberto={menu === `i-${item.id}`} onAlternar={alternarMenu(`i-${item.id}`)}>
              {modo === 'planejado' && (
                <BotaoIcone titulo="Repetir o planejado nos meses seguintes" onClick={() => props.onRepetir(item)}>
                  <Repeat className="h-3.5 w-3.5" />
                </BotaoIcone>
              )}
              <BotaoIcone titulo="Editar categoria" onClick={() => props.onEditarItem(item)}>
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
              <BotaoIcone titulo="Remover categoria" perigo onClick={() => props.onRemoverItem(item)}>
                <Trash2 className="h-3.5 w-3.5" />
              </BotaoIcone>
            </Acoes>
          </div>
        </td>
        {meses.map((mes, i) => {
          const manual = props.manual.get(`${item.id}|${mes}`)
          const sugestao = props.recorrente.get(`${item.id}|${mes}`)
          return (
            <td key={mes} className={cn(COL_MES, LINHA, 'py-1 text-right', destaque(i))}>
              {modo === 'planejado' ? (
                <MoneyCommit
                  aria-label={`Planejado de ${item.name} em ${MESES_CURTOS[i]}`}
                  placeholder={sugestao !== undefined ? fmt(sugestao) : '—'}
                  title={sugestao !== undefined && manual === undefined ? 'Vem das recorrências (digite pra mudar)' : undefined}
                  inicial={manual ?? ''}
                  onCommit={(v) => props.onSalvar(item.id, mes, v)}
                />
              ) : (
                <div className="flex h-9 items-center justify-end px-2.5 text-base md:text-sm">
                  {celulaComparada(tipo, real[i], plano[i])}
                </div>
              )}
            </td>
          )
        })}
        <td className={cn(LINHA, 'px-3 py-1.5 text-right font-medium tabular-nums')}>{fmt(total(exibida))}</td>
        <td className={cn(LINHA, 'px-3 py-1.5 text-right tabular-nums text-muted-foreground')}>{fmt(media(exibida))}</td>
      </tr>
    )
  }

  // Linha de totais (grupo ou resumo).
  function linhaTotal(rotulo: ReactNode, tipo: TipoGrupo, real: Serie, plano: Serie, classe?: string) {
    const exibida = modo === 'planejado' ? plano : real
    return (
      <tr className={cn('font-semibold', classe)}>
        <td className={cn(COL_NOME, LINHA, 'bg-muted px-4 py-2')}>
          <span className="block truncate">{rotulo}</span>
        </td>
        {exibida.map((v, i) => (
          <td key={i} className={cn(COL_MES, LINHA, 'bg-muted py-2 text-right', destaque(i))}>
            {modo === 'planejado' ? (
              <span className="tabular-nums">{fmt(v)}</span>
            ) : (
              celulaComparada(tipo, real[i], plano[i], true)
            )}
          </td>
        ))}
        <td className={cn(LINHA, 'bg-muted px-3 py-2 text-right tabular-nums')}>{fmt(total(exibida))}</td>
        <td className={cn(LINHA, 'bg-muted px-3 py-2 text-right tabular-nums text-muted-foreground')}>
          {fmt(media(exibida))}
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
              <th className={cn(COL_NOME, 'z-20 border-b border-border bg-muted/40 px-4 py-2.5 text-left')}>Categoria</th>
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
            const temValor = (i: Item) =>
              itemVisivel(i, [
                ...serieDoItem(i.id, meses, props.realizado),
                ...serieDoItem(i.id, meses, props.plano),
              ])
            const mostrarOcultos = verOcultos.has(g.id)
            const visiveis = doGrupo.filter((i) => mostrarOcultos || temValor(i))
            const qtdOcultos = doGrupo.length - doGrupo.filter(temValor).length
            const subs = categorias.filter((c) => c.group_id === g.id)
            const soltos = visiveis.filter((i) => !i.category_id || !subs.some((c) => c.id === i.category_id))
            const totalReal = resumoReal.porGrupo.get(g.id) ?? []
            const totalPlano = resumoPlano.porGrupo.get(g.id) ?? []
            const totalExibido = modo === 'planejado' ? totalPlano : totalReal

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
                        <BotaoIcone titulo="Nova categoria" onClick={() => props.onNovoItem(g)}>
                          <Plus className="h-3.5 w-3.5" />
                        </BotaoIcone>
                        <BotaoIcone titulo="Novo subgrupo" onClick={() => props.onNovaCategoria(g)}>
                          <FolderPlus className="h-3.5 w-3.5" />
                        </BotaoIcone>
                        <BotaoIcone titulo="Editar grupo e meta" onClick={() => props.onEditarGrupo(g)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </BotaoIcone>
                        <BotaoIcone titulo="Remover grupo" perigo onClick={() => props.onRemoverGrupo(g)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </BotaoIcone>
                      </Acoes>
                    </div>
                  </td>
                  <td colSpan={14} className="border-t-4 border-background px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={cn('rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset', tipo.selo)}>
                        {tipo.label}
                      </span>
                      {g.meta_pct != null && g.tipo !== 'receita' && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Target className="h-3 w-3" /> Meta: {textoMeta(g.tipo, Number(g.meta_pct))}
                        </span>
                      )}
                      {g.descricao && <span className="truncate text-muted-foreground">{g.descricao}</span>}
                      {qtdOcultos > 0 && (
                        <button
                          type="button"
                          onClick={() => setVerOcultos((s) => alternar(s, g.id))}
                          className="ml-2 flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <EyeOff className="h-3 w-3" />
                          {mostrarOcultos ? 'Esconder ocultas' : `${qtdOcultos} oculta${qtdOcultos > 1 ? 's' : ''}`}
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
                            <Plus className="h-3.5 w-3.5" /> Adicionar a primeira categoria
                          </button>
                        </td>
                      </tr>
                    )}

                    {soltos.map((i) => linhaItem(i, g.tipo, false))}

                    {subs.map((c) => (
                      <Fragment key={c.id}>
                        <tr className="group/linha">
                          <td className={cn(COL_NOME, LINHA, 'bg-muted/30 py-1.5 pl-4 pr-1')}>
                            <div className="flex items-center gap-1">
                              <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {c.name}
                              </span>
                              <Acoes aberto={menu === `c-${c.id}`} onAlternar={alternarMenu(`c-${c.id}`)}>
                                <BotaoIcone titulo={`Nova categoria em ${c.name}`} onClick={() => props.onNovoItem(g, c.id)}>
                                  <Plus className="h-3.5 w-3.5" />
                                </BotaoIcone>
                                <BotaoIcone titulo="Renomear subgrupo" onClick={() => props.onEditarCategoria(c)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </BotaoIcone>
                                <BotaoIcone titulo="Remover subgrupo" perigo onClick={() => props.onRemoverCategoria(c)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </BotaoIcone>
                              </Acoes>
                            </div>
                          </td>
                          <td colSpan={14} className={cn(LINHA, 'bg-muted/30')} />
                        </tr>
                        {visiveis.filter((i) => i.category_id === c.id).map((i) => linhaItem(i, g.tipo, true))}
                      </Fragment>
                    ))}
                  </>
                )}

                {linhaTotal(`Total ${g.name}`, g.tipo, totalReal, totalPlano)}
                {g.tipo !== 'receita' && (
                  <tr className="text-xs text-muted-foreground">
                    <td className={cn(COL_NOME, 'px-4 py-1.5')}>% da receita</td>
                    {totalExibido.map((v, i) => {
                      const pct = pctDaReceita(v, rExibido.receita[i])
                      return (
                        <td
                          key={i}
                          className={cn(
                            COL_MES,
                            'py-1.5 text-right tabular-nums',
                            destaque(i),
                            metaFora(g.tipo, pct, g.meta_pct == null ? null : Number(g.meta_pct)) && 'font-semibold text-destructive',
                          )}
                        >
                          {fmtPct(pct)}
                        </td>
                      )
                    })}
                    {(() => {
                      const pct = pctDaReceita(total(totalExibido), total(rExibido.receita))
                      return (
                        <td
                          className={cn(
                            'px-3 py-1.5 text-right tabular-nums',
                            metaFora(g.tipo, pct, g.meta_pct == null ? null : Number(g.meta_pct)) && 'font-semibold text-destructive',
                          )}
                        >
                          {fmtPct(pct)}
                        </td>
                      )
                    })()}
                    <td />
                  </tr>
                )}
              </tbody>
            )
          })}

          {/* Resumo: receitas − investimentos − despesas = saldo */}
          <tbody>
            <tr>
              <td className={cn(COL_NOME, 'border-t-4 border-background px-4 pb-1 pt-4')}>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumo</span>
              </td>
              <td colSpan={14} className="border-t-4 border-background" />
            </tr>
            {grupos.map((g) => (
              <Fragment key={g.id}>
                {linhaTotal(
                  <span className="flex items-center gap-2 font-normal">
                    <span className="text-muted-foreground">{g.tipo === 'receita' ? '+' : '−'}</span>
                    <span className="truncate">{g.name}</span>
                  </span>,
                  g.tipo,
                  resumoReal.porGrupo.get(g.id) ?? [],
                  resumoPlano.porGrupo.get(g.id) ?? [],
                  'font-normal',
                )}
              </Fragment>
            ))}
            <tr className="text-base font-bold">
              <td className={cn(COL_NOME, 'border-t-2 border-foreground/20 bg-muted px-4 py-2.5')}>= Saldo</td>
              {rExibido.saldo.map((v, i) => (
                <td
                  key={i}
                  className={cn(
                    COL_MES,
                    'border-t-2 border-foreground/20 bg-muted py-2.5 text-right tabular-nums',
                    v !== undefined && (v >= 0 ? 'text-success' : 'text-destructive'),
                  )}
                >
                  {fmt(v)}
                  {modo === 'comparar' && resumoPlano.saldo[i] !== undefined && (
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      de {fmtCurto(resumoPlano.saldo[i]!)}
                    </span>
                  )}
                </td>
              ))}
              <td
                className={cn(
                  'border-t-2 border-foreground/20 bg-muted px-3 py-2.5 text-right tabular-nums',
                  total(rExibido.saldo) >= 0 ? 'text-success' : 'text-destructive',
                )}
              >
                {fmt(total(rExibido.saldo))}
              </td>
              <td className="border-t-2 border-foreground/20 bg-muted px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {fmt(media(rExibido.saldo))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}
