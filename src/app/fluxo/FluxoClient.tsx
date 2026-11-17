'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  Wallet,
  Plus,
  Trash2,
  Pencil,
  Repeat,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Upload,
  Receipt,
  CalendarDays,
  CreditCard,
  CalendarClock,
  SkipForward,
  Check,
} from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { NumberField } from '@/components/ui/number-field'
import { MoedaToggle, simboloMoeda } from '@/components/ui/moeda-toggle'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { MonthPicker } from '@/components/ui/month-picker'
import { hojeISO, formatData, fimDoMes, rotuloMes } from '@/lib/utils'
import {
  formatBRL,
  formatMoeda,
  valorEmBRL,
  gerarParcelas,
  saldo,
  totalEntradas,
  totalSaidas,
  type Moeda,
  type Transaction,
} from '@/server/fluxo/fluxo.calc'
import { parseStatement, type ParsedItem } from '@/server/fluxo/statement'
import { usePromptDialog } from '@/components/ui/prompt'
import type { BudgetBucket } from '@/server/orcamento/orcamento.calc'
import { CategoriaSelect, gruposDoTipo, nomeCategoria, type Plano } from '@/components/shared/CategoriaSelect'
import { dataNoMes, type Previsto } from '@/server/recorrencia/recorrencia.calc'
import { useCotacao } from '@/lib/useRates'

// Função (não constante): a data é a de HOJE no momento em que o formulário
// abre — como constante, ficava congelada no dia em que a página carregou.
const novoVazio = () => ({
  tipo: 'saida' as 'entrada' | 'saida',
  valor: '',
  moeda: 'BRL' as Moeda,
  data: hojeISO(),
  descricao: '',
  item_id: '', // categoria do plano de contas
  budget_id: '', // fatia do Orçamento (só saída)
  repetir: false, // ao criar: vira uma recorrência (previsão todo mês)
  parcelado: false,
  parcelas: '2', // nº de parcelas quando 'parcelado' está ligado
})

export default function FluxoClient() {
  const router = useRouter()
  const ask = usePromptDialog()
  const { rates, aoVivo } = useCotacao()

  const [txs, setTxs] = useState<Transaction[]>([])
  const [fatias, setFatias] = useState<BudgetBucket[]>([])
  const [plano, setPlano] = useState<Plano>({ grupos: [], categorias: [], itens: [] })
  const [previstos, setPrevistos] = useState<Previsto[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)
  const [editId, setEditId] = useState<string | null>(null) // null = criando; id = editando
  const [f, setF] = useState(novoVazio)

  // filtros da listagem — começa no mês atual (botão "Todo período" zera o filtro)
  const [fMes, setFMes] = useState(hojeISO().slice(0, 7)) // 'AAAA-MM' ou '' (todos)
  const [fTipo, setFTipo] = useState<'' | 'entrada' | 'saida'>('')

  // importação de fatura
  const [impAberto, setImpAberto] = useState(false)
  const [impItens, setImpItens] = useState<ParsedItem[]>([])
  const [impFormato, setImpFormato] = useState<string | null>(null)
  const [impFatia, setImpFatia] = useState('')
  const [impResumo, setImpResumo] = useState<string | null>(null)

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((c) => ({ ...c, [k]: v }))
  }

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

  // Cadastros (fatias + plano de contas). Recarregam ao abrir o formulário e ao
  // voltar pra aba, pra pegar o que foi criado no Orçamento ou no Controle Anual.
  const carregarCadastros = useCallback(async () => {
    try {
      const [fs, pl] = await Promise.all([api('/api/budget'), api('/api/anual/estrutura')])
      setFatias(fs)
      setPlano(pl)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [api])

  // Lançamentos recarregam sempre que um filtro muda (filtro vai pro back).
  const carregarTx = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (fMes) {
        params.set('de', `${fMes}-01`)
        params.set('ate', fimDoMes(fMes))
      }
      if (fTipo) params.set('tipo', fTipo)
      const qs = params.toString()
      const [t, pv] = await Promise.all([
        api('/api/transaction' + (qs ? `?${qs}` : '')),
        // Previsões das recorrências só fazem sentido com um mês escolhido.
        fMes ? api(`/api/recorrencia/previstos?mes=${fMes}-01`) : Promise.resolve([]),
      ])
      setTxs(t)
      setPrevistos(pv)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [api, fMes, fTipo])

  useEffect(() => {
    carregarCadastros()
    const aoVoltar = () => document.visibilityState === 'visible' && carregarCadastros()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [carregarCadastros])

  useEffect(() => {
    carregarTx()
  }, [carregarTx])

  function abrirNovo() {
    carregarCadastros()
    setEditId(null)
    setF(novoVazio())
    setErro(null)
    setAberto(true)
  }

  // Abre o mesmo modal, mas pré-preenchido pra editar um lançamento existente.
  function abrirEditar(t: Transaction) {
    carregarCadastros()
    setEditId(t.id)
    setF({
      tipo: t.tipo,
      valor: String(t.valor),
      moeda: t.moeda ?? 'BRL',
      data: t.data.slice(0, 10),
      descricao: t.descricao ?? '',
      item_id: t.item_id ?? '',
      budget_id: t.budget_id ?? '',
      repetir: false,
      parcelado: false, // não dá pra "re-parcelar" ao editar
      parcelas: '2',
    })
    setErro(null)
    setAberto(true)
  }

  async function lancar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    try {
      if (editId) {
        // Editando: PATCH só dos campos do lançamento (sem parcelas).
        await api(`/api/transaction/${editId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: f.tipo,
            valor: Number(f.valor),
            moeda: f.moeda,
            data: f.data,
            descricao: f.descricao || null,
            item_id: f.item_id || null,
            budget_id: f.tipo === 'saida' ? f.budget_id || null : null,
          }),
        })
      } else {
        const parcelar = f.tipo === 'saida' && f.parcelado && Number(f.parcelas) >= 2
        // "Repetir todo mês" vai junto: o servidor cria o lançamento e a
        // recorrência numa chamada só (sem deixar meio feito).
        await api('/api/transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: f.tipo,
            valor: Number(f.valor),
            moeda: f.moeda,
            data: f.data,
            descricao: f.descricao || null,
            item_id: f.item_id || null,
            budget_id: f.tipo === 'saida' ? f.budget_id || null : null,
            parcelas: parcelar ? Number(f.parcelas) : undefined,
            repetir: !parcelar && f.repetir ? true : undefined,
          }),
        })
      }
      setAberto(false)
      await carregarTx()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  // Nova categoria direto no plano de contas (num grupo do tipo certo).
  async function criarCategoria() {
    try {
      const grupos = gruposDoTipo(plano.grupos, f.tipo)
      if (grupos.length === 0) {
        setErro(
          `Crie antes um grupo de ${f.tipo === 'entrada' ? 'receita' : 'despesa'} no Controle Anual (é o plano de contas).`,
        )
        return
      }
      const v = await ask({
        title: `Nova categoria de ${f.tipo === 'entrada' ? 'receita' : 'despesa'}`,
        fields: [
          { name: 'name', label: 'Nome da categoria', placeholder: f.tipo === 'entrada' ? 'Salário' : 'Mercado' },
          { name: 'group_id', label: 'Grupo', type: 'select', options: grupos.map((g) => ({ value: g.id, label: g.name })) },
        ],
      })
      if (!v?.name) return
      const nova = await api('/api/anual/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: v.name,
          group_id: v.group_id,
          ordem: plano.itens.filter((i) => i.group_id === v.group_id).length + 1,
        }),
      })
      await carregarCadastros()
      set('item_id', nova.id)
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  // Previsão do mês (recorrência) -> lançamento de verdade.
  async function confirmarPrevisto(p: Previsto, ajustar = false) {
    let valor = p.valor
    let data = p.data
    if (ajustar) {
      const v = await ask({
        title: `Confirmar ${p.recorrencia.descricao}`,
        submitLabel: 'Confirmar',
        fields: [
          { name: 'valor', label: 'Valor deste mês', type: 'money', prefixo: simboloMoeda(p.recorrencia.moeda), valor: String(p.valor) },
          { name: 'dia', label: 'Dia', type: 'dia', valor: String(Number(p.data.slice(8, 10))) },
        ],
      })
      if (!v) return
      valor = Number(v.valor) || p.valor
      // Dia além do fim do mês (31 em fevereiro) vira o último dia.
      data = dataNoMes({ dia: Math.min(Math.max(Number(v.dia) || 1, 1), 31) }, p.mes)
    }
    try {
      await api(`/api/recorrencia/${p.recorrencia.id}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes: p.mes, valor, data }),
      })
      await carregarTx()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function pularPrevisto(p: Previsto) {
    if (!confirm(`Pular "${p.recorrencia.descricao}" em ${rotuloMes(p.mes.slice(0, 7))}? Os outros meses continuam.`)) return
    try {
      await api(`/api/recorrencia/${p.recorrencia.id}/acao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'pular', mes: p.mes }),
      })
      await carregarTx()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function excluir(t: Transaction) {
    try {
      // Parcela faz parte de uma compra: excluir apaga a compra inteira.
      if (t.parcela_grupo && t.parcela_total) {
        const todas = confirm(
          `Esta é a parcela ${t.parcela_num}/${t.parcela_total} de uma compra parcelada.\n\n` +
            `OK = excluir as ${t.parcela_total} parcelas\nCancelar = manter`,
        )
        if (!todas) return
        await api(`/api/transaction/grupo/${t.parcela_grupo}`, { method: 'DELETE' })
        await carregarTx()
        return
      }
      const msg = t.recorrencia_id
        ? 'Excluir este lançamento? A recorrência continua e o mês volta a aparecer como "a confirmar".'
        : 'Excluir este lançamento?'
      if (!confirm(msg)) return
      await api(`/api/transaction/${t.id}`, { method: 'DELETE' })
      await carregarTx()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  function abrirImport() {
    setImpItens([])
    setImpFormato(null)
    setImpFatia('')
    setImpResumo(null)
    setErro(null)
    setImpAberto(true)
  }

  // Lê o arquivo e faz o PREVIEW no próprio navegador (parser é puro).
  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImpResumo(null)
    try {
      const texto = await file.text()
      const { formato, itens } = parseStatement(texto)
      setImpFormato(formato)
      setImpItens(itens)
      setErro(itens.length === 0 ? 'Não reconheci lançamentos nesse arquivo.' : null)
    } catch {
      setErro('Não consegui ler esse arquivo.')
    }
  }

  async function confirmarImport() {
    setErro(null)
    try {
      const r = await api('/api/transaction/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_id: impFatia || null, itens: impItens }),
      })
      setImpResumo(`${r.importados} importados · ${r.ignorados} já existiam.`)
      setImpItens([])
      await carregarTx()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  const nomeDaCategoria = (id: string | null | undefined) => nomeCategoria(plano, id)
  const nomeFatia = (id: string | null) => fatias.find((x) => x.id === id)?.name ?? '—'

  const aConfirmar = previstos.filter((p) => !p.confirmada && (!fTipo || p.recorrencia.tipo === fTipo))

  // Preview das parcelas (mesmíssimo cálculo que o back vai usar).
  const previewParcelas = useMemo(() => {
    const total = Number(f.valor)
    const n = Number(f.parcelas)
    if (!f.parcelado || !total || n < 2) return null
    const ps = gerarParcelas(total, n, f.data)
    return {
      n,
      valor: ps[0].valor,
      primeira: rotuloMes(ps[0].data.slice(0, 7)),
      ultima: rotuloMes(ps[ps.length - 1].data.slice(0, 7)),
    }
  }, [f.parcelado, f.valor, f.parcelas, f.data])

  const resultado = saldo(txs, rates)
  const temFiltro = Boolean(fMes || fTipo)

  return (
    <PageLayout
      title="Lançamentos"
      description="Entradas e saídas do mês, com as recorrências a confirmar"
      icon={Wallet}
      actions={
        <>
          <Button variant="outline" onClick={abrirImport}>
            <Upload /> Importar fatura
          </Button>
          <Button onClick={abrirNovo}>
            <Plus /> Novo lançamento
          </Button>
        </>
      }
    >
      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Período</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={fMes ? 'outline' : 'default'}
              onClick={() => setFMes('')}
            >
              Todo período
            </Button>
            <MonthPicker value={fMes || hojeISO().slice(0, 7)} onChange={setFMes} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tipo</Label>
          <Select
            className="w-40"
            value={fTipo}
            onChange={(e) => setFTipo(e.target.value as typeof fTipo)}
          >
            <option value="">Todos</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
          </Select>
        </div>
        {temFiltro && (
          <Button
            variant="ghost"
            onClick={() => {
              setFMes('')
              setFTipo('')
            }}
          >
            Limpar
          </Button>
        )}
        <span className="ml-auto self-center text-sm text-muted-foreground">
          <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
          {fMes ? rotuloMes(fMes) : 'Todo o período'} · {txs.length} lançamento
          {txs.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* KPIs (refletem o filtro) */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Entradas"
          value={formatBRL(totalEntradas(txs, rates))}
          icon={ArrowUpRight}
          accent="success"
        />
        <StatCard
          label="Saídas"
          value={formatBRL(totalSaidas(txs, rates))}
          icon={ArrowDownRight}
          accent="destructive"
        />
        <StatCard
          label="Saldo"
          value={formatBRL(resultado)}
          icon={Scale}
          accent={resultado >= 0 ? 'success' : 'destructive'}
          highlight
        />
      </div>

      {erro && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      {/* Lista */}
      {/* Recorrências do mês ainda não confirmadas */}
      {aConfirmar.length > 0 && (
        <Card className="mb-5 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarClock className="h-4 w-4 text-primary" />
              A confirmar em {rotuloMes(fMes)}
            </div>
            <div className="text-xs text-muted-foreground">
              {(() => {
                const soma = (t: 'entrada' | 'saida') =>
                  aConfirmar
                    .filter((p) => p.recorrencia.tipo === t)
                    .reduce((s, p) => s + valorEmBRL(p.valor, p.recorrencia.moeda, rates), 0)
                return `Entradas ${formatBRL(soma('entrada'))} · Saídas ${formatBRL(soma('saida'))}`
              })()}
            </div>
          </div>
          <ul className="divide-y divide-border">
            {aConfirmar.map((p) => (
              <li key={p.recorrencia.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${p.recorrencia.tipo === 'entrada' ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}
                >
                  {p.recorrencia.tipo === 'entrada' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.recorrencia.descricao}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatData(p.data)} · {nomeDaCategoria(p.recorrencia.item_id) ?? 'sem categoria'}
                  </div>
                </div>
                <div className="text-right font-semibold tabular-nums">
                  {formatMoeda(p.valor, p.recorrencia.moeda)}
                </div>
                <div className="flex w-full justify-end gap-1.5 sm:w-auto">
                  <Button size="sm" variant="ghost" onClick={() => pularPrevisto(p)} title="Não acontece este mês">
                    <SkipForward /> Pular
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => confirmarPrevisto(p, true)} title="Confirmar com outro valor ou dia">
                    <Pencil /> Ajustar
                  </Button>
                  <Button size="sm" onClick={() => confirmarPrevisto(p)}>
                    <Check /> {p.recorrencia.tipo === 'entrada' ? 'Recebido' : 'Pago'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {txs.length === 0 ? (
        <EmptyState
          icon={Receipt}
          titulo={temFiltro ? 'Nenhum lançamento no filtro' : 'Nenhum lançamento ainda'}
          descricao={
            temFiltro
              ? 'Tente outro mês ou limpe os filtros.'
              : 'Registre sua primeira entrada ou saída pra começar a enxergar seu fluxo.'
          }
          acao={
            temFiltro ? (
              <Button
                variant="outline"
                onClick={() => {
                  setFMes('')
                  setFTipo('')
                }}
              >
                Limpar filtros
              </Button>
            ) : (
              <Button onClick={abrirNovo}>
                <Plus /> Novo lançamento
              </Button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Fatia</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                    {formatData(t.data)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{t.descricao || '—'}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {nomeDaCategoria(t.item_id) ?? (
                        <span className="text-amber-600">sem categoria</span>
                      )}
                      {t.recorrencia_id && (
                        <Badge variant="secondary" title="Lançamento de uma recorrência">
                          <Repeat className="h-3 w-3" /> recorrência
                        </Badge>
                      )}
                      {t.parcela_total && (
                        <Badge variant="secondary">
                          <CreditCard className="h-3 w-3" /> {t.parcela_num}/{t.parcela_total}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{t.tipo === 'saida' ? nomeFatia(t.budget_id) : '—'}</td>
                  <td className="px-4 py-3">
                    {t.tipo === 'entrada' ? (
                      <Badge variant="success">
                        <ArrowUpRight className="h-3 w-3" /> Entrada
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <ArrowDownRight className="h-3 w-3" /> Saída
                      </Badge>
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold tabular-nums ${t.tipo === 'entrada' ? 'text-emerald-600' : 'text-destructive'}`}
                  >
                    <div>
                      {t.tipo === 'entrada' ? '+' : '−'}{' '}
                      {formatMoeda(Number(t.valor), t.moeda ?? 'BRL')}
                    </div>
                    {t.moeda && t.moeda !== 'BRL' && (
                      <div className="text-[10px] font-normal text-muted-foreground">
                        ≈ {formatBRL(valorEmBRL(t.valor, t.moeda, rates))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => abrirEditar(t)}
                        aria-label="Editar lançamento"
                        title="Editar lançamento"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => excluir(t)}
                        aria-label="Remover lançamento"
                        title="Remover lançamento"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      )}

      {/* Modal de novo lançamento / edição */}
      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title={editId ? 'Editar lançamento' : 'Novo lançamento'}
      >
        <form onSubmit={lancar} className="space-y-4">
          {/* Tipo */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                set('tipo', 'saida')
                set('item_id', '')
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${f.tipo === 'saida' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
            >
              <ArrowDownRight className="mr-1 inline h-4 w-4" />
              Saída
            </button>
            <button
              type="button"
              onClick={() => {
                set('tipo', 'entrada')
                set('item_id', '')
                set('budget_id', '')
                set('parcelado', false)
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${f.tipo === 'entrada' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
            >
              <ArrowUpRight className="mr-1 inline h-4 w-4" />
              Entrada
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="valor">Valor *</Label>
              <MoneyInput
                id="valor"
                prefixo={simboloMoeda(f.moeda)}
                placeholder="0,00"
                value={f.valor}
                onValueChange={(v) => set('valor', v)}
                required
                autoFocus
              />
              <MoedaToggle
                tamanho="sm"
                label="Moeda do lançamento"
                value={f.moeda}
                onChange={(m) => set('moeda', m)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data">Data *</Label>
              <Input
                id="data"
                type="date"
                value={f.data}
                onChange={(e) => set('data', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Preview da conversão pra real (moeda estrangeira) */}
          {f.moeda !== 'BRL' && Number(f.valor) > 0 && (
            <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              ≈ <strong className="text-foreground">{formatBRL(valorEmBRL(f.valor, f.moeda, rates))}</strong>{' '}
              · cotação {aoVivo ? 'ao vivo' : 'estimada (sem conexão)'} {f.moeda}{' '}
              {formatBRL(f.moeda === 'USD' ? rates.USD : rates.EUR)}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição</Label>
            <Input
              id="desc"
              placeholder="Ex: Mercado da semana, Salário"
              value={f.descricao}
              onChange={(e) => set('descricao', e.target.value)}
            />
          </div>

          <div className={f.tipo === 'saida' ? 'grid grid-cols-2 gap-3' : 'grid gap-3'}>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <div className="flex gap-1">
                <CategoriaSelect plano={plano} tipo={f.tipo} value={f.item_id} onChange={(v) => set('item_id', v)} />
                <Button type="button" variant="outline" size="icon" onClick={criarCategoria} aria-label="Nova categoria" title="Nova categoria">
                  <Plus />
                </Button>
              </div>
            </div>
            {f.tipo === 'saida' && (
              <div className="space-y-1.5">
                <Label htmlFor="fatia">Fatia do orçamento</Label>
                <Select id="fatia" value={f.budget_id} onChange={(e) => set('budget_id', e.target.value)}>
                  <option value="">Sem fatia</option>
                  {fatias.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          {/* Parcelamento — só pra saída nova (não dá pra re-parcelar ao editar) */}
          {f.tipo === 'saida' && !editId && (
            <div className="rounded-lg border border-border p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={f.parcelado}
                  onChange={(e) => set('parcelado', e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                Compra parcelada
              </label>

              {f.parcelado && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="parcelas" className="text-sm">
                      Em
                    </Label>
                    <NumberField
                      id="parcelas"
                      tamanho="sm"
                      casas={0}
                      sufixo="x"
                      className="w-20"
                      value={f.parcelas}
                      onValueChange={(v) => set('parcelas', v)}
                    />
                    <span className="text-sm text-muted-foreground">parcelas (o valor é o total)</span>
                  </div>
                  {previewParcelas && (
                    <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                      {previewParcelas.n}x de{' '}
                      <strong className="text-foreground">{formatBRL(previewParcelas.valor)}</strong> ·{' '}
                      de {previewParcelas.primeira} a {previewParcelas.ultima}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {!f.parcelado && !editId && (
            <label className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-sm">
              <input
                type="checkbox"
                checked={f.repetir}
                onChange={(e) => set('repetir', e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              />
              <span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Repeat className="h-4 w-4 text-primary" /> Repetir todo mês
                </span>
                <span className="block text-xs text-muted-foreground">
                  Cria uma recorrência. Os próximos meses aparecem como “a confirmar”, e dá pra pausar ou
                  finalizar em Recorrências.
                </span>
              </span>
            </label>
          )}

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit">{editId ? 'Salvar' : 'Lançar'}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal de importar fatura (OFX/CSV) */}
      <Modal open={impAberto} onClose={() => setImpAberto(false)} title="Importar fatura">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Arquivo (OFX ou CSV)</Label>
            <input
              type="file"
              accept=".ofx,.csv,.txt"
              onChange={aoEscolherArquivo}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
            <p className="text-xs text-muted-foreground">
              Baixe a fatura/extrato no app do seu banco (formato OFX é o mais confiável).
            </p>
          </div>

          {impItens.length > 0 && (
            <>
              <div className="space-y-1.5">
                <Label>Fatia das saídas</Label>
                <Select value={impFatia} onChange={(e) => setImpFatia(e.target.value)}>
                  <option value="">Sem fatia</option>
                  {fatias.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">
                  {impItens.length} lançamento{impItens.length === 1 ? '' : 's'} detectado
                  {impItens.length === 1 ? '' : 's'}{' '}
                  <span className="text-muted-foreground">({impFormato})</span>
                </p>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <tbody>
                      {impItens.slice(0, 60).map((it, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                            {formatData(it.data)}
                          </td>
                          <td className="px-2 py-1.5">{it.descricao}</td>
                          <td
                            className={`px-2 py-1.5 text-right font-medium whitespace-nowrap tabular-nums ${it.tipo === 'entrada' ? 'text-emerald-600' : 'text-destructive'}`}
                          >
                            {it.tipo === 'entrada' ? '+' : '−'} {formatBRL(it.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {impItens.length > 60 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    …e mais {impItens.length - 60}. Todos serão importados.
                  </p>
                )}
              </div>
            </>
          )}

          {impResumo && (
            <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
              {impResumo}
            </p>
          )}
          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setImpAberto(false)}>
              Fechar
            </Button>
            <Button type="button" onClick={confirmarImport} disabled={impItens.length === 0}>
              Importar {impItens.length > 0 ? impItens.length : ''}
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}
