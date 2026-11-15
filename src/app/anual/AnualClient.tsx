'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarRange,
  Link2,
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
import { formatBRL, valorEmBRL, type Moeda } from '@/server/fluxo/fluxo.calc'
import { useCotacao } from '@/lib/useRates'
import { mesAtualBR } from '@/server/patrimonio/patrimonio.calc'
import {
  chave,
  aplicarFluxo,
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
  type FluxoDoItem,
  type Valores,
} from '@/server/anual/anual.calc'
import { OPCOES_TIPO } from './tipos'
import { LigarFluxoDialog, tipoFluxoDoGrupo, type CategoriaFluxo } from './LigarFluxoDialog'
import { GradeAnual } from './GradeAnual'
import { GraficosAnual } from './GraficosAnual'

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

  // ---------------- Fluxo de Caixa -> Controle Anual
  const { rates } = useCotacao()
  const [catsFluxo, setCatsFluxo] = useState<CategoriaFluxo[]>([])
  const [fluxo, setFluxo] = useState<{ porItem: FluxoDoItem[]; semLigacao: { moeda: string; valor: number; qtd: number }[] }>({
    porItem: [],
    semLigacao: [],
  })
  const [ligando, setLigando] = useState<Item | null>(null)
  const buscarFluxo = useCallback(
    () =>
      Promise.all([
        api('/api/category') as Promise<CategoriaFluxo[]>,
        api(`/api/anual/fluxo?ano=${ano}`) as Promise<typeof fluxo>,
      ]),
    [api, ano],
  )
  const recarregarFluxo = useCallback(
    () =>
      buscarFluxo().then(([c, f]) => {
        setCatsFluxo(c)
        setFluxo(f)
      }),
    [buscarFluxo],
  )
  useEffect(() => {
    let vivo = true
    buscarFluxo()
      .then(([c, f]) => {
        if (!vivo) return
        setCatsFluxo(c)
        setFluxo(f)
      })
      .catch((e) => vivo && setErro((e as Error).message))
    return () => {
      vivo = false
    }
  }, [buscarFluxo])

  // item -> nomes das categorias do Fluxo que o alimentam
  const ligados = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const c of catsFluxo) {
      if (!c.annual_item_id) continue
      m.set(c.annual_item_id, [...(m.get(c.annual_item_id) ?? []), c.name])
    }
    return m
  }, [catsFluxo])
  const emReal = useCallback((v: number, m: string) => valorEmBRL(v, m as Moeda, rates), [rates])
  // Valores que a tela usa: manuais + (itens ligados) soma do Fluxo em real.
  const efetivos = useMemo(
    () => aplicarFluxo(valores, fluxo.porItem, new Set(ligados.keys()), emReal),
    [valores, fluxo.porItem, ligados, emReal],
  )
  const foraDoAnual = fluxo.semLigacao.reduce(
    (s, x) => ({ valor: s.valor + emReal(x.valor, x.moeda), qtd: s.qtd + x.qtd }),
    { valor: 0, qtd: 0 },
  )

  async function salvarLigacao(item: Item, ligar: string[], desligar: string[]) {
    await acao(
      () =>
        Promise.all([
          ...ligar.map((id) => enviar(`/api/category/${id}`, 'PATCH', { annual_item_id: item.id })),
          ...desligar.map((id) => enviar(`/api/category/${id}`, 'PATCH', { annual_item_id: null })),
        ]),
      recarregarFluxo,
    )
  }

  // Cria um item pra cada categoria do Fluxo (do tipo certo) ainda sem ligação.
  async function puxarDoFluxo(g: Grupo) {
    const tipo = tipoFluxoDoGrupo(g.tipo)
    const soltas = catsFluxo.filter((c) => c.tipo === tipo && !c.annual_item_id)
    if (soltas.length === 0) {
      setErro(
        `Todas as categorias de ${tipo === 'entrada' ? 'entrada' : 'saída'} do Fluxo já estão ligadas (ou não há nenhuma).`,
      )
      return
    }
    if (
      !confirm(
        `Criar ${soltas.length} ${soltas.length === 1 ? 'item' : 'itens'} em "${g.name}" a partir das categorias do Fluxo?\n\n${soltas
          .map((c) => `• ${c.name}`)
          .join('\n')}\n\nOs valores passam a vir dos lançamentos do Fluxo.`,
      )
    )
      return
    let ordem = itens.filter((i) => i.group_id === g.id).length
    await acao(
      async () => {
        for (const c of soltas) {
          ordem += 1
          const novo = (await enviar('/api/anual/item', 'POST', { group_id: g.id, name: c.name, ordem })) as Item
          await enviar(`/api/category/${c.id}`, 'PATCH', { annual_item_id: novo.id })
        }
      },
      () => Promise.all([carregarEstrutura(), recarregarFluxo()]),
    )
  }

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
      ],
    })
    if (!v?.name) return
    acao(
      () =>
        enviar('/api/anual/grupo', 'POST', {
          name: v.name,
          tipo: v.tipo as TipoGrupo,
          descricao: v.descricao || null,
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
      ],
    })
    if (!v?.name) return
    acao(
      () =>
        enviar(`/api/anual/grupo/${g.id}`, 'PATCH', {
          name: v.name,
          tipo: v.tipo,
          descricao: v.descricao || null,
        }),
      carregarEstrutura,
    )
  }

  function removerGrupo(g: Grupo) {
    if (!confirm(`Remover o grupo "${g.name}" com todos os itens dele? Os valores somem dos totais.`))
      return
    acao(() => enviar(`/api/anual/grupo/${g.id}`, 'DELETE'), carregarEstrutura)
  }

  async function novaCategoria(g: Grupo) {
    const v = await ask({
      title: `Nova categoria em ${g.name}`,
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
      title: 'Renomear categoria',
      submitLabel: 'Salvar',
      fields: [{ name: 'name', label: 'Nome', valor: c.name }],
    })
    if (!v?.name) return
    acao(() => enviar(`/api/anual/categoria/${c.id}`, 'PATCH', { name: v.name }), carregarEstrutura)
  }

  function removerCategoria(c: Categoria) {
    if (!confirm(`Remover a categoria "${c.name}"? Os itens dela continuam, direto no grupo.`)) return
    acao(() => enviar(`/api/anual/categoria/${c.id}`, 'DELETE'), carregarEstrutura)
  }

  const opcoesCategoria = (groupId: string) => [
    { value: '', label: 'Sem categoria' },
    ...categorias.filter((c) => c.group_id === groupId).map((c) => ({ value: c.id, label: c.name })),
  ]

  async function novoItem(g: Grupo, categoriaId: string | null = null) {
    const temCategorias = categorias.some((c) => c.group_id === g.id)
    const v = await ask({
      title: `Novo item em ${g.name}`,
      fields: [
        { name: 'name', label: 'Nome', placeholder: 'Ex.: Aluguel, Luz, Salário' },
        ...(temCategorias
          ? [
              {
                name: 'category_id',
                label: 'Categoria',
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
      title: 'Editar item',
      submitLabel: 'Salvar',
      fields: [
        { name: 'name', label: 'Nome', valor: item.name },
        ...(temCategorias
          ? [
              {
                name: 'category_id',
                label: 'Categoria',
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
        `Remover "${item.name}" de vez?\n\nOs valores dele somem dos totais de TODOS os anos. Se só parou de usar, prefira Ocultar.`,
      )
    )
      return
    acao(() => enviar(`/api/anual/item/${item.id}`, 'DELETE'), carregarEstrutura)
  }

  // ---------------- números do ano
  const r = useMemo(() => resumo(grupos, itens, efetivos, ano), [grupos, itens, efetivos, ano])
  const receitaAno = total(r.receita)
  const despesaAno = total(r.despesa)
  const investAno = total(r.investimento)
  const saldoAno = total(r.saldo)
  const mesDestaque = ano === anoAtual ? Number(mesAtualBR().slice(5, 7)) - 1 : null

  return (
    <PageLayout
      title="Controle Anual"
      description="Receitas, investimentos e despesas mês a mês"
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
          descricao="Crie os grupos do seu jeito: um de receitas, um de investimentos e quantos de despesas quiser (fixas, variáveis, extras…). Depois adicione os itens e preencha os meses."
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
            <StatCard label={`Receita em ${ano}`} value={formatBRL(receitaAno)} icon={Wallet} />
            <StatCard
              label={`Despesas em ${ano}`}
              value={formatBRL(despesaAno)}
              icon={Receipt}
              sub={fmtPct(pctDaReceita(despesaAno, receitaAno))}
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
              sub="Receita − investimentos − despesas"
              highlight
            />
          </div>

          {foraDoAnual.qtd > 0 && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
              <Link2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>{formatBRL(foraDoAnual.valor)}</strong> em {foraDoAnual.qtd} lançamento
                {foraDoAnual.qtd > 1 ? 's' : ''} do Fluxo em {ano} ainda não {foraDoAnual.qtd > 1 ? 'entram' : 'entra'} no
                Controle Anual (categoria não ligada ou sem categoria). Use <strong>Puxar do Fluxo</strong> no grupo
                ou <strong>Ligar ao Fluxo</strong> no item.
              </span>
            </div>
          )}

          <GradeAnual
            mesDestaque={mesDestaque}
            grupos={grupos}
            categorias={categorias}
            itens={itens}
            valores={efetivos}
            ligados={ligados}
            onLigarItem={setLigando}
            onPuxarFluxo={puxarDoFluxo}
            resumo={r}
            onSalvar={salvarCelula}
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

          <GraficosAnual grupos={grupos} itens={itens} valores={efetivos} resumo={r} />

          {ligando && (
            <LigarFluxoDialog
              item={ligando}
              tipoGrupo={grupos.find((g) => g.id === ligando.group_id)?.tipo ?? 'despesa'}
              categorias={catsFluxo}
              itens={itens}
              onClose={() => setLigando(null)}
              onSalvar={(ligar, desligar) => salvarLigacao(ligando, ligar, desligar)}
            />
          )}
        </>
      )}
    </PageLayout>
  )
}
