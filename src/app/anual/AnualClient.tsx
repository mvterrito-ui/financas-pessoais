'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarRange,
  CircleAlert,
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Receipt,
} from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { usePromptDialog } from '@/components/ui/prompt'
import { formatBRL, valorEmBRL, type Moeda, type Transaction } from '@/server/fluxo/fluxo.calc'
import { dataNoMes } from '@/server/recorrencia/recorrencia.calc'
import { useCotacao } from '@/lib/useRates'
import { mesAtualBR } from '@/server/patrimonio/patrimonio.calc'
import {
  chave,
  somarEmReal,
  indexar,
  mesesDoAno,
  pctDaReceita,
  preencherAdiante,
  resumo,
  serieDoItem,
  total,
  type Categoria,
  type Grupo,
  type Item,
  type TipoGrupo,
  type ValorMes,
  type SomaPorMes,
  type Valores,
} from '@/server/anual/anual.calc'
import { OPCOES_TIPO } from './tipos'
import { GradeAnual, type ModoGrade } from './GradeAnual'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { GraficosAnual } from './GraficosAnual'
import { LancamentosCelula } from './LancamentosCelula'

const fmtPct = (p: number | null) =>
  p === null ? '' : `${p.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% da receita`

export default function AnualClient() {
  const router = useRouter()
  const ask = usePromptDialog()
  const anoAtual = Number(mesAtualBR().slice(0, 4))
  const [ano, setAno] = useState(anoAtual)
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [itens, setItens] = useState<Item[]>([])
  const [valores, setValores] = useState<Valores>(new Map())
  const [carregado, setCarregado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const api = useCallback(
    async (url: string, init?: RequestInit) => {
      const res = await fetch(url, init)
      if (res.status === 401) {
        router.push('/login')
        throw new Error('Sessão expirada')
      }
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? 'Erro na requisição')
      return body
    },
    [router],
  )
  const enviar = useCallback(
    (url: string, method: string, body?: unknown) =>
      api(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    [api],
  )

  // Busca (sem mexer em estado) + aplica: os efeitos só fazem setState quando
  // a resposta chega, e as ações reaproveitam o mesmo caminho pra recarregar.
  const buscarEstrutura = useCallback(
    () => api('/api/anual/estrutura') as Promise<{ grupos: Grupo[]; categorias: Categoria[]; itens: Item[] }>,
    [api],
  )
  const aplicarEstrutura = (e: { grupos: Grupo[]; categorias: Categoria[]; itens: Item[] }) => {
    setGrupos(e.grupos)
    setCategorias(e.categorias)
    setItens(e.itens)
  }
  const carregarEstrutura = useCallback(
    () => buscarEstrutura().then(aplicarEstrutura),
    [buscarEstrutura],
  )

  useEffect(() => {
    let vivo = true
    buscarEstrutura()
      .then((e) => vivo && aplicarEstrutura(e))
      .catch((e) => vivo && setErro((e as Error).message))
      .finally(() => vivo && setCarregado(true))
    return () => {
      vivo = false
    }
  }, [buscarEstrutura])

  useEffect(() => {
    let vivo = true
    api(`/api/anual/valor?ano=${ano}`)
      .then((linhas) => vivo && setValores(indexar(linhas as ValorMes[])))
      .catch((e) => vivo && setErro((e as Error).message))
    return () => {
      vivo = false
    }
  }, [api, ano])

  // ---------------- realizado (lançamentos) e recorrências do ano
  const { rates } = useCotacao()
  const [modo, setModo] = useState<ModoGrade>('comparar')
  const [dadosAno, setDadosAno] = useState<{
    realizado: SomaPorMes[]
    previsto: SomaPorMes[]
    semCategoria: { moeda: string; valor: number; qtd: number }[]
  }>({ realizado: [], previsto: [], semCategoria: [] })
  // Lançamentos do ano, pra editar o realizado direto na grade.
  const [lancs, setLancs] = useState<Transaction[]>([])
  const buscarAno = useCallback(
    () =>
      Promise.all([
        api(`/api/anual/realizado?ano=${ano}`),
        api(`/api/transaction?de=${ano}-01-01&ate=${ano}-12-31`) as Promise<Transaction[]>,
      ]),
    [api, ano],
  )
  const recarregarAno = useCallback(
    () =>
      buscarAno().then(([f, t]) => {
        setDadosAno(f)
        setLancs(t)
      }),
    [buscarAno],
  )
  useEffect(() => {
    let vivo = true
    buscarAno()
      .then(([f, t]) => {
        if (!vivo) return
        setDadosAno(f)
        setLancs(t)
      })
      .catch((e) => vivo && setErro((e as Error).message))
    return () => {
      vivo = false
    }
  }, [buscarAno])
  const lancsPorCelula = useMemo(() => {
    const m = new Map<string, Transaction[]>()
    for (const t of lancs) {
      if (!t.item_id) continue
      const k = chave(t.item_id, `${t.data.slice(0, 7)}-01`)
      m.set(k, [...(m.get(k) ?? []), t])
    }
    return m
  }, [lancs])

  const emReal = useCallback((v: number, m: string) => valorEmBRL(v, m as Moeda, rates), [rates])
  const realizado = useMemo(() => somarEmReal(dadosAno.realizado, emReal), [dadosAno.realizado, emReal])
  const recorrente = useMemo(() => somarEmReal(dadosAno.previsto, emReal), [dadosAno.previsto, emReal])
  // Planejado: só o que foi digitado. As recorrências aparecem apenas como
  // sugestão em cinza no modo Planejado.
  const plano = valores
  const semCategoria = dadosAno.semCategoria.reduce(
    (s, x) => ({ valor: s.valor + emReal(x.valor, x.moeda), qtd: s.qtd + x.qtd }),
    { valor: 0, qtd: 0 },
  )

  // Executa uma ação; em erro mostra a mensagem. `depois` recarrega o necessário.
  const acao = useCallback(async (fn: () => Promise<unknown>, depois?: () => Promise<unknown>) => {
    setErro(null)
    try {
      await fn()
      await depois?.()
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [])

  // ---------------- valores (otimista: atualiza a tela antes do servidor)
  const gravarValores = useCallback(
    async (itemId: string, lista: { mes: string; valor: number | null }[]) => {
      // Guarda o valor anterior SÓ das células deste envio: se falhar, desfaz
      // só elas (antes voltava o mapa inteiro e apagava outros salvamentos).
      const anteriores = lista.map(({ mes }) => [chave(itemId, mes), valores.get(chave(itemId, mes))] as const)
      setValores((atual) => {
        const novo = new Map(atual)
        for (const { mes, valor } of lista) {
          if (valor === null) novo.delete(chave(itemId, mes))
          else novo.set(chave(itemId, mes), valor)
        }
        return novo
      })
      try {
        await enviar('/api/anual/valor', 'POST', { item_id: itemId, valores: lista })
      } catch (e) {
        setValores((atual) => {
          const novo = new Map(atual)
          for (const [k, v] of anteriores) {
            if (v === undefined) novo.delete(k)
            else novo.set(k, v)
          }
          return novo
        })
        setErro((e as Error).message)
      }
    },
    [valores, enviar],
  )

  const salvarCelula = (itemId: string, mes: string, txt: string) =>
    gravarValores(itemId, [{ mes, valor: txt === '' ? null : Number(txt) || 0 }])

  // ---------------- realizado editado na grade (grava nos lançamentos)
  const [celula, setCelula] = useState<{ item: Item; tipo: TipoGrupo; mes: string } | null>(null)
  // Muda quando a exclusão é cancelada: os campos voltam pro valor salvo.
  const [desfeito, setDesfeito] = useState(0)
  const tipoLanc = (tipo: TipoGrupo) => (tipo === 'receita' ? 'entrada' : 'saida')

  const novoLancamento = (item: Item, tipo: TipoGrupo, mes: string, valor: number, dia: number) =>
    acao(
      () =>
        enviar('/api/transaction', 'POST', {
          tipo: tipoLanc(tipo),
          valor,
          moeda: 'BRL',
          data: dataNoMes({ dia }, mes),
          descricao: item.name,
          item_id: item.id,
        }),
      recarregarAno,
    )

  const valorLancamento = (t: Transaction, txt: string) => {
    if (!(Number(txt) > 0)) return removerLancamento(t)
    acao(() => enviar(`/api/transaction/${t.id}`, 'PATCH', { valor: Number(txt) }), recarregarAno)
  }

  function removerLancamento(t: Transaction) {
    if (!confirm(`Excluir o lançamento "${t.descricao || 'sem descrição'}" de ${t.data.split('-').reverse().join('/')}?`)) {
      setDesfeito((n) => n + 1)
      return
    }
    acao(() => enviar(`/api/transaction/${t.id}`, 'DELETE'), recarregarAno)
  }

  // Célula com 0 ou 1 lançamento em real: o valor digitado vai direto pro lançamento.
  const salvarReal = (item: Item, tipo: TipoGrupo, mes: string, txt: string) => {
    const atual = lancsPorCelula.get(chave(item.id, mes)) ?? []
    if (atual.length === 1) return valorLancamento(atual[0], txt)
    if (atual.length === 0 && Number(txt) > 0) {
      const hoje = new Date()
      const dia = mes.slice(0, 7) === mesAtualBR().slice(0, 7) ? hoje.getDate() : 1
      novoLancamento(item, tipo, mes, Number(txt), dia)
    }
  }

  const repetir = (item: Item) => {
    const meses = mesesDoAno(ano)
    const faltam = preencherAdiante(serieDoItem(item.id, meses, valores))
    if (faltam.length === 0) {
      setErro(`"${item.name}": preencha um mês primeiro. Os meses vazios seguintes recebem esse valor.`)
      return
    }
    gravarValores(
      item.id,
      faltam.map((f) => ({ mes: meses[f.indice], valor: f.valor })),
    )
  }

  // ---------------- estrutura
  async function novoGrupo() {
    const v = await ask({
      title: 'Novo grupo',
      fields: [
        { name: 'name', label: 'Nome', placeholder: 'Ex.: Despesas fixas' },
        { name: 'tipo', label: 'Tipo (define a conta do saldo)', type: 'select', options: OPCOES_TIPO },
        { name: 'descricao', label: 'Descrição (opcional)', placeholder: 'Ex.: todo mês, valor não muda' },
        { name: 'meta_pct', label: 'Meta em % da receita (opcional)', type: 'number', sufixo: '%', placeholder: 'Ex.: 50' },
      ],
    })
    if (!v?.name) return
    acao(
      () =>
        enviar('/api/anual/grupo', 'POST', {
          name: v.name,
          tipo: v.tipo as TipoGrupo,
          descricao: v.descricao || null,
          meta_pct: v.meta_pct ? Math.min(100, Number(v.meta_pct)) : null,
          ordem: grupos.length + 1,
        }),
      carregarEstrutura,
    )
  }

  async function editarGrupo(g: Grupo) {
    const v = await ask({
      title: 'Editar grupo',
      submitLabel: 'Salvar',
      fields: [
        { name: 'name', label: 'Nome', valor: g.name },
        { name: 'tipo', label: 'Tipo', type: 'select', options: OPCOES_TIPO, valor: g.tipo },
        { name: 'descricao', label: 'Descrição (opcional)', valor: g.descricao ?? '' },
        {
          name: 'meta_pct',
          label: 'Meta em % da receita (despesa: até; investimento: pelo menos)',
          type: 'number',
          sufixo: '%',
          valor: g.meta_pct != null ? String(g.meta_pct) : '',
        },
      ],
    })
    if (!v?.name) return
    acao(
      () =>
        enviar(`/api/anual/grupo/${g.id}`, 'PATCH', {
          name: v.name,
          tipo: v.tipo,
          descricao: v.descricao || null,
          meta_pct: v.meta_pct ? Math.min(100, Number(v.meta_pct)) : null,
        }),
      carregarEstrutura,
    )
  }

  function removerGrupo(g: Grupo) {
    if (!confirm(`Remover o grupo "${g.name}" com todas as categorias dele? Lançamentos dessas categorias ficam sem categoria.`))
      return
    acao(() => enviar(`/api/anual/grupo/${g.id}`, 'DELETE'), carregarEstrutura)
  }

  async function novaCategoria(g: Grupo) {
    const v = await ask({
      title: `Novo subgrupo em ${g.name}`,
      fields: [{ name: 'name', label: 'Nome', placeholder: 'Ex.: Moradia, Transporte' }],
    })
    if (!v?.name) return
    const ordem = categorias.filter((c) => c.group_id === g.id).length + 1
    acao(
      () => enviar('/api/anual/categoria', 'POST', { group_id: g.id, name: v.name, ordem }),
      carregarEstrutura,
    )
  }

  async function editarCategoria(c: Categoria) {
    const v = await ask({
      title: 'Renomear subgrupo',
      submitLabel: 'Salvar',
      fields: [{ name: 'name', label: 'Nome', valor: c.name }],
    })
    if (!v?.name) return
    acao(() => enviar(`/api/anual/categoria/${c.id}`, 'PATCH', { name: v.name }), carregarEstrutura)
  }

  function removerCategoria(c: Categoria) {
    if (!confirm(`Remover o subgrupo "${c.name}"? As categorias dele continuam, direto no grupo.`)) return
    acao(() => enviar(`/api/anual/categoria/${c.id}`, 'DELETE'), carregarEstrutura)
  }

  const opcoesCategoria = (groupId: string) => [
    { value: '', label: 'Sem subgrupo' },
    ...categorias.filter((c) => c.group_id === groupId).map((c) => ({ value: c.id, label: c.name })),
  ]

  async function novoItem(g: Grupo, categoriaId: string | null = null) {
    const temCategorias = categorias.some((c) => c.group_id === g.id)
    const v = await ask({
      title: `Nova categoria em ${g.name}`,
      fields: [
        { name: 'name', label: 'Nome da categoria', placeholder: 'Ex.: Aluguel, Luz, Salário' },
        ...(temCategorias
          ? [
              {
                name: 'category_id',
                label: 'Subgrupo',
                type: 'select' as const,
                options: opcoesCategoria(g.id),
                valor: categoriaId ?? '',
              },
            ]
          : []),
      ],
    })
    if (!v?.name) return
    const ordem = itens.filter((i) => i.group_id === g.id).length + 1
    acao(
      () =>
        enviar('/api/anual/item', 'POST', {
          group_id: g.id,
          category_id: (temCategorias ? v.category_id : categoriaId) || null,
          name: v.name,
          ordem,
        }),
      carregarEstrutura,
    )
  }

  async function editarItem(item: Item) {
    const temCategorias = categorias.some((c) => c.group_id === item.group_id)
    const v = await ask({
      title: 'Editar categoria',
      submitLabel: 'Salvar',
      fields: [
        { name: 'name', label: 'Nome', valor: item.name },
        ...(temCategorias
          ? [
              {
                name: 'category_id',
                label: 'Subgrupo',
                type: 'select' as const,
                options: opcoesCategoria(item.group_id),
                valor: item.category_id ?? '',
              },
            ]
          : []),
      ],
    })
    if (!v?.name) return
    acao(
      () =>
        enviar(`/api/anual/item/${item.id}`, 'PATCH', {
          name: v.name,
          ...(temCategorias ? { category_id: v.category_id || null } : {}),
        }),
      carregarEstrutura,
    )
  }

  function ocultarItem(item: Item, oculto: boolean) {
    if (
      oculto &&
      !confirm(
        `Ocultar "${item.name}"?\n\nEle some dos anos em que não tem valor. Onde já tem valor, continua aparecendo (o histórico fica).`,
      )
    )
      return
    acao(() => enviar(`/api/anual/item/${item.id}`, 'PATCH', { oculto }), carregarEstrutura)
  }

  function removerItem(item: Item) {
    if (
      !confirm(
        `Remover a categoria "${item.name}"?\n\nOs lançamentos dela ficam sem categoria e somem dos totais. Se só parou de usar, prefira Ocultar.`,
      )
    )
      return
    acao(() => enviar(`/api/anual/item/${item.id}`, 'DELETE'), carregarEstrutura)
  }

  // ---------------- números do ano
  const rReal = useMemo(() => resumo(grupos, itens, realizado, ano), [grupos, itens, realizado, ano])
  const rPlano = useMemo(() => resumo(grupos, itens, plano, ano), [grupos, itens, plano, ano])
  const receitaAno = total(rReal.receita)
  const despesaAno = total(rReal.despesa)
  const investAno = total(rReal.investimento)
  const saldoAno = total(rReal.saldo)
  const planejadoDe = (s: (number | undefined)[]) => `Planejado ${formatBRL(total(s))}`
  const mesDestaque = ano === anoAtual ? Number(mesAtualBR().slice(5, 7)) - 1 : null

  return (
    <PageLayout
      title="Controle Anual"
      description="Planejado e realizado do ano, por categoria"
      icon={CalendarRange}
      actions={
        <Button onClick={novoGrupo}>
          <Plus /> Novo grupo
        </Button>
      }
    >
      {/* Ano */}
      <div className="mb-4 flex items-center gap-1">
        <Button variant="outline" size="icon" onClick={() => setAno((a) => a - 1)} aria-label="Ano anterior">
          <ChevronLeft />
        </Button>
        <span className="w-20 text-center text-lg font-semibold tabular-nums">{ano}</span>
        <Button variant="outline" size="icon" onClick={() => setAno((a) => a + 1)} aria-label="Próximo ano">
          <ChevronRight />
        </Button>
        {ano !== anoAtual && (
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => setAno(anoAtual)}>
            Voltar pra {anoAtual}
          </Button>
        )}
      </div>

      {erro && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
      )}

      {carregado && grupos.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          titulo="Monte o seu controle anual"
          descricao="Este é o seu plano de contas. Crie os grupos do seu jeito: um de receitas, um de investimentos e quantos de despesas quiser (fixas, variáveis, extras…). Depois adicione as categorias. Lançamentos e recorrências usam este mesmo plano."
          acao={
            <Button onClick={novoGrupo}>
              <Plus /> Criar primeiro grupo
            </Button>
          }
        />
      ) : (
        <>
          {/* Números do ano */}
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={`Receita em ${ano}`} value={formatBRL(receitaAno)} icon={Wallet} sub={planejadoDe(rPlano.receita)} />
            <StatCard
              label={`Despesas em ${ano}`}
              value={formatBRL(despesaAno)}
              icon={Receipt}
              sub={`${fmtPct(pctDaReceita(despesaAno, receitaAno))} · ${planejadoDe(rPlano.despesa)}`}
            />
            <StatCard
              label={`Investido em ${ano}`}
              value={formatBRL(investAno)}
              icon={PiggyBank}
              sub={fmtPct(pctDaReceita(investAno, receitaAno))}
            />
            <StatCard
              label={`Saldo de ${ano}`}
              value={formatBRL(saldoAno)}
              icon={saldoAno >= 0 ? TrendingUp : TrendingDown}
              accent={saldoAno >= 0 ? 'success' : 'destructive'}
              sub={planejadoDe(rPlano.saldo)}
              highlight
            />
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div role="radiogroup" aria-label="O que ver na grade" className="inline-flex rounded-xl bg-muted p-1">
              {(
                [
                  ['comparar', 'Comparar'],
                  ['realizado', 'Realizado'],
                  ['planejado', 'Planejado'],
                ] as [ModoGrade, string][]
              ).map(([m, rotulo]) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={modo === m}
                  onClick={() => setModo(m)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                    modo === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {modo === 'comparar' &&
                'Edite o realizado na célula: o valor vai pros lançamentos. Embaixo, o planejado digitado.'}
              {modo === 'realizado' && 'Edite o valor na célula e ele vai pros lançamentos.'}
              {modo === 'planejado' && 'Digite o planejado. Em cinza, o que as recorrências preveem.'}
            </p>
          </div>

          {semCategoria.qtd > 0 && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>{formatBRL(semCategoria.valor)}</strong> em {semCategoria.qtd} lançamento
                {semCategoria.qtd > 1 ? 's' : ''} de {ano} sem categoria (não {semCategoria.qtd > 1 ? 'entram' : 'entra'} na
                grade).{' '}
                <Link href="/fluxo" className="font-medium underline underline-offset-2">
                  Categorizar em Lançamentos
                </Link>
              </span>
            </div>
          )}

          <GradeAnual
            modo={modo}
            mesDestaque={mesDestaque}
            grupos={grupos}
            categorias={categorias}
            itens={itens}
            realizado={realizado}
            plano={plano}
            manual={valores}
            recorrente={recorrente}
            resumoReal={rReal}
            resumoPlano={rPlano}
            lancamentos={lancsPorCelula}
            desfeito={desfeito}
            onSalvar={salvarCelula}
            onSalvarReal={salvarReal}
            onAbrirCelula={(item, tipo, mes) => setCelula({ item, tipo, mes })}
            onRepetir={repetir}
            onEditarItem={editarItem}
            onOcultarItem={ocultarItem}
            onRemoverItem={removerItem}
            onNovoItem={novoItem}
            onNovaCategoria={novaCategoria}
            onEditarCategoria={editarCategoria}
            onRemoverCategoria={removerCategoria}
            onEditarGrupo={editarGrupo}
            onRemoverGrupo={removerGrupo}
          />

          <GraficosAnual grupos={grupos} itens={itens} valores={realizado} resumo={rReal} />

          {celula && (
            <LancamentosCelula
              titulo={celula.item.name}
              mes={celula.mes}
              lancamentos={lancsPorCelula.get(chave(celula.item.id, celula.mes)) ?? []}
              desfeito={desfeito}
              onFechar={() => setCelula(null)}
              onValor={valorLancamento}
              onRemover={removerLancamento}
              onNovo={(valor, dia) => novoLancamento(celula.item, celula.tipo, celula.mes, valor, dia)}
            />
          )}

        </>
      )}
    </PageLayout>
  )
}
