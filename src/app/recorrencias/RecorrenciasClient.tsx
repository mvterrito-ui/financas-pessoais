'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarX2,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Scale,
  Trash2,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { CategoriaSelect, nomeCategoria, type Plano } from '@/components/shared/CategoriaSelect'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { MoneyInput } from '@/components/ui/money-input'
import { NumberField } from '@/components/ui/number-field'
import { MoedaToggle, simboloMoeda, type MoedaCodigo } from '@/components/ui/moeda-toggle'
import { usePromptDialog } from '@/components/ui/prompt'
import { useCotacao } from '@/lib/useRates'
import { cn, formatData, rotuloMes } from '@/lib/utils'
import { formatBRL, valorEmBRL } from '@/server/fluxo/fluxo.calc'
import type { BudgetBucket } from '@/server/orcamento/orcamento.calc'
import { mesAtualBR } from '@/server/patrimonio/patrimonio.calc'
import {
  pausaQueCobre,
  proximaOcorrencia,
  statusEm,
  valorNoMes,
  type AjusteValor,
  type Pausa,
  type Recorrencia,
  type Status,
} from '@/server/recorrencia/recorrencia.calc'

const STATUS: Record<Status, { label: string; selo: string }> = {
  ativa: { label: 'Ativa', selo: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  pausada: { label: 'Pausada', selo: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  finalizada: { label: 'Finalizada', selo: 'bg-muted text-muted-foreground ring-border' },
  futura: { label: 'Começa depois', selo: 'bg-sky-50 text-sky-700 ring-sky-600/20' },
}
type Filtro = 'ativas' | 'pausadas' | 'finalizadas' | 'todas'

const fmtMoeda = (v: number, m: MoedaCodigo) => v.toLocaleString('pt-BR', { style: 'currency', currency: m })

/** Meses (AAAA-MM-01) a partir de `inicio`, pra escolher num select. */
function opcoesDeMes(inicio: string, quantos: number, antes = 0) {
  const [a, m] = inicio.split('-').map(Number)
  return Array.from({ length: quantos + antes }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - antes + i, 1))
    const v = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
    return { value: v, label: rotuloMes(v.slice(0, 7)) }
  })
}

type Form = {
  tipo: 'entrada' | 'saida'
  descricao: string
  valor: string
  moeda: MoedaCodigo
  item_id: string
  budget_id: string // fatia do Orçamento (só despesa)
  dia: string
  inicio: string // AAAA-MM
  fim: string // AAAA-MM ou ''
}

export default function RecorrenciasClient() {
  const router = useRouter()
  const ask = usePromptDialog()
  const { rates } = useCotacao()
  const mesAtual = mesAtualBR() // AAAA-MM-01

  const [recs, setRecs] = useState<Recorrencia[]>([])
  const [pausas, setPausas] = useState<Pausa[]>([])
  const [ajustes, setAjustes] = useState<AjusteValor[]>([])
  const [plano, setPlano] = useState<Plano>({ grupos: [], categorias: [], itens: [] })
  const [fatias, setFatias] = useState<BudgetBucket[]>([])
  const [carregado, setCarregado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('ativas')
  const [form, setForm] = useState<Form | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

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
  const enviar = (url: string, method: string, body?: unknown) =>
    api(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })

  const buscar = useCallback(
    () => Promise.all([api('/api/recorrencia'), api('/api/anual/estrutura'), api('/api/budget')]),
    [api],
  )
  const aplicar = ([r, pl, c]: [{ recorrencias: Recorrencia[]; pausas: Pausa[]; ajustes: AjusteValor[] }, Plano, BudgetBucket[]]) => {
    setRecs(r.recorrencias)
    setPausas(r.pausas)
    setAjustes(r.ajustes)
    setPlano(pl)
    setFatias(c)
  }
  const recarregar = useCallback(() => buscar().then(aplicar), [buscar])

  useEffect(() => {
    let vivo = true
    buscar()
      .then((d) => vivo && aplicar(d))
      .catch((e) => vivo && setErro((e as Error).message))
      .finally(() => vivo && setCarregado(true))
    return () => {
      vivo = false
    }
  }, [buscar])

  async function acao(fn: () => Promise<unknown>) {
    setErro(null)
    try {
      await fn()
      await recarregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  // ---------- números do mês atual (em real)
  const status = (r: Recorrencia) => statusEm(r, pausas, mesAtual)
  const doMes = (tipo: 'entrada' | 'saida') =>
    recs
      .filter((r) => r.tipo === tipo && status(r) === 'ativa')
      .reduce((s, r) => s + valorEmBRL(valorNoMes(r, ajustes, mesAtual), r.moeda, rates), 0)
  const receitas = doMes('entrada')
  const despesas = doMes('saida')
  const pausadas = recs.filter((r) => status(r) === 'pausada').length

  const visiveis = useMemo(
    () =>
      recs.filter((r) => {
        const st = statusEm(r, pausas, mesAtual)
        if (filtro === 'todas') return true
        if (filtro === 'ativas') return st === 'ativa' || st === 'futura'
        if (filtro === 'pausadas') return st === 'pausada'
        return st === 'finalizada'
      }),
    [recs, pausas, mesAtual, filtro],
  )

  // ---------- formulário (nova / editar)
  function abrirNova() {
    setEditId(null)
    setErro(null)
    setForm({
      tipo: 'saida',
      descricao: '',
      valor: '',
      moeda: 'BRL',
      item_id: '',
      budget_id: '',
      dia: String(Number(new Date().getDate())),
      inicio: mesAtual.slice(0, 7),
      fim: '',
    })
  }
  function abrirEditar(r: Recorrencia) {
    setEditId(r.id)
    setErro(null)
    setForm({
      tipo: r.tipo,
      descricao: r.descricao,
      valor: String(r.valor),
      moeda: r.moeda,
      item_id: r.item_id ?? '',
      budget_id: r.budget_id ?? '',
      dia: String(r.dia),
      inicio: r.inicio.slice(0, 7),
      fim: r.fim ? r.fim.slice(0, 7) : '',
    })
  }
  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    if (!(Number(form.valor) > 0)) return setErro('Informe o valor.')
    if (form.fim && form.fim < form.inicio) return setErro('O último mês não pode ser antes do início.')
    const corpo = {
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      valor: Number(form.valor),
      moeda: form.moeda,
      item_id: form.item_id || null,
      budget_id: form.tipo === 'saida' ? form.budget_id || null : null,
      dia: Math.min(31, Math.max(1, Number(form.dia) || 1)),
      inicio: `${form.inicio}-01`,
      fim: form.fim ? `${form.fim}-01` : null,
    }
    setSalvando(true)
    setErro(null)
    try {
      if (editId) await enviar(`/api/recorrencia/${editId}`, 'PATCH', corpo)
      else await enviar('/api/recorrencia', 'POST', corpo)
      setForm(null)
      await recarregar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  // ---------- ações
  const acaoEm = (r: Recorrencia, corpo: Record<string, unknown>) =>
    acao(() => enviar(`/api/recorrencia/${r.id}/acao`, 'POST', corpo))

  async function pausar(r: Recorrencia) {
    const v = await ask({
      title: `Pausar ${r.descricao}`,
      submitLabel: 'Pausar',
      fields: [
        { name: 'mes', label: 'A partir de', type: 'select', options: opcoesDeMes(mesAtual, 13) },
        {
          name: 'ate',
          label: 'Volta em',
          type: 'select',
          options: [{ value: '', label: 'Quando eu retomar' }, ...opcoesDeMes(mesAtual, 24)],
        },
      ],
    })
    if (!v) return
    // "Volta em X" = pausada até o mês ANTERIOR a X.
    let ate: string | null = null
    if (v.ate) {
      const [a, m] = v.ate.split('-').map(Number)
      const d = new Date(Date.UTC(a, m - 2, 1))
      ate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
      if (ate < v.mes) return setErro('A volta tem que ser depois do início da pausa.')
    }
    acaoEm(r, { acao: 'pausar', mes: v.mes, ate })
  }

  function retomar(r: Recorrencia) {
    const p = pausaQueCobre(r, pausas, mesAtual) ?? pausas.find((x) => x.recorrencia_id === r.id && !x.ate)
    if (!p) return
    // Pausa que ainda nem começou: retomar = cancelar a pausa.
    const mes = p.de.slice(0, 10) > mesAtual ? p.de.slice(0, 10) : mesAtual
    acaoEm(r, { acao: 'retomar', mes })
  }

  async function reajustar(r: Recorrencia) {
    const v = await ask({
      title: `Novo valor · ${r.descricao}`,
      submitLabel: 'Salvar',
      fields: [
        { name: 'mes', label: 'A partir de', type: 'select', options: opcoesDeMes(mesAtual, 13, 3), valor: mesAtual },
        {
          name: 'valor',
          label: 'Novo valor',
          type: 'money',
          prefixo: simboloMoeda(r.moeda),
          valor: String(valorNoMes(r, ajustes, mesAtual)),
        },
      ],
    })
    if (!v?.valor || !(Number(v.valor) > 0)) return
    acaoEm(r, { acao: 'reajustar', mes: v.mes, valor: Number(v.valor) })
  }

  async function finalizar(r: Recorrencia) {
    const v = await ask({
      title: `Finalizar ${r.descricao}`,
      submitLabel: 'Finalizar',
      fields: [
        {
          name: 'mes',
          label: 'Último mês em que acontece',
          type: 'select',
          options: opcoesDeMes(mesAtual, 24, 6).filter((o) => o.value >= r.inicio.slice(0, 10)),
          valor: mesAtual,
        },
      ],
    })
    if (!v?.mes) return
    acaoEm(r, { acao: 'finalizar', mes: v.mes })
  }

  function remover(r: Recorrencia) {
    if (!confirm(`Excluir a recorrência "${r.descricao}"?\n\nOs lançamentos já confirmados continuam no caixa.`)) return
    acao(() => enviar(`/api/recorrencia/${r.id}`, 'DELETE'))
  }

  // Função de renderização (não componente): declarar componente dentro do
  // render faria o React recriá-lo a cada renderização.
  function renderLista(tipo: 'entrada' | 'saida', titulo: string, Icon: LucideIcon) {
    const lista = visiveis.filter((r) => r.tipo === tipo)
    if (lista.length === 0) return null
    return (
      <Card className="mb-5 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3 text-sm font-medium">
          <Icon className={cn('h-4 w-4', tipo === 'entrada' ? 'text-emerald-600' : 'text-destructive')} />
          {titulo}
          <span className="text-muted-foreground">· {lista.length}</span>
        </div>
        <ul className="divide-y divide-border">
          {lista.map((r) => {
            const st = statusEm(r, pausas, mesAtual)
            const valor = valorNoMes(r, ajustes, mesAtual)
            const proxima = st === 'finalizada' ? null : proximaOcorrencia(r, pausas, mesAtual)
            const pausa = pausaQueCobre(r, pausas, mesAtual)
            const temAjuste = ajustes.some((a) => a.recorrencia_id === r.id)
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{r.descricao}</span>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', STATUS[st].selo)}>
                      {STATUS[st].label}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {[
                      nomeCategoria(plano, r.item_id) ?? 'sem categoria',
                      `todo dia ${r.dia}`,
                      fatias.find((x) => x.id === r.budget_id)?.name,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {st === 'pausada' && pausa && (pausa.ate ? `Pausada até ${rotuloMes(pausa.ate.slice(0, 7))}` : 'Pausada até você retomar')}
                    {st === 'finalizada' && r.fim && `Terminou em ${rotuloMes(r.fim.slice(0, 7))}`}
                    {st === 'futura' && `Começa em ${rotuloMes(r.inicio.slice(0, 7))}`}
                    {st === 'ativa' &&
                      `Desde ${rotuloMes(r.inicio.slice(0, 7))}${r.fim ? ` · até ${rotuloMes(r.fim.slice(0, 7))}` : ''}`}
                    {proxima && st !== 'finalizada' && ` · próxima: ${formatData(proxima)}`}
                  </div>
                </div>

                <div className="text-right">
                  <div className={cn('font-semibold tabular-nums', tipo === 'entrada' ? 'text-emerald-600' : 'text-destructive')}>
                    {tipo === 'entrada' ? '+' : '−'} {fmtMoeda(valor, r.moeda)}
                  </div>
                  {temAjuste && <div className="text-[11px] text-muted-foreground">valor reajustado</div>}
                </div>

                <div className="flex w-full flex-wrap justify-end gap-1 sm:w-auto">
                  {st === 'pausada' ? (
                    <Button size="sm" variant="outline" onClick={() => retomar(r)} title="Voltar a prever todo mês">
                      <Play /> Retomar
                    </Button>
                  ) : st !== 'finalizada' ? (
                    <Button size="sm" variant="outline" onClick={() => pausar(r)} title="Parar por um tempo">
                      <Pause /> Pausar
                    </Button>
                  ) : null}
                  {st !== 'finalizada' && (
                    <Button size="sm" variant="ghost" onClick={() => reajustar(r)} title="Novo valor a partir de um mês">
                      <TrendingUp /> Reajustar
                    </Button>
                  )}
                  {st === 'finalizada' || r.fim ? (
                    <Button size="sm" variant="ghost" onClick={() => acaoEm(r, { acao: 'reativar' })} title="Tirar a data de término">
                      <RotateCcw /> Reativar
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => finalizar(r)} title="Definir o último mês">
                      <CalendarX2 /> Finalizar
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    onClick={() => abrirEditar(r)}
                    aria-label={`Editar ${r.descricao}`}
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 hover:text-destructive"
                    onClick={() => remover(r)}
                    aria-label={`Excluir ${r.descricao}`}
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
    )
  }

  return (
    <PageLayout
      title="Recorrências"
      description="Receitas e despesas fixas: cada mês vira uma previsão a confirmar"
      icon={Repeat}
      actions={
        <Button onClick={abrirNova}>
          <Plus /> Nova recorrência
        </Button>
      }
    >
      {erro && !form && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
      )}

      {carregado && recs.length === 0 ? (
        <EmptyState
          icon={Repeat}
          titulo="Nenhuma recorrência ainda"
          descricao="Cadastre o que se repete todo mês: salário, aluguel, academia, assinaturas. Elas aparecem em Lançamentos como previsões pra confirmar, e entram no planejado do Controle Anual."
          acao={
            <Button onClick={abrirNova}>
              <Plus /> Nova recorrência
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Receitas fixas no mês" value={formatBRL(receitas)} icon={ArrowUpRight} accent="success" />
            <StatCard label="Despesas fixas no mês" value={formatBRL(despesas)} icon={ArrowDownRight} accent="destructive" />
            <StatCard
              label="Saldo fixo"
              value={formatBRL(receitas - despesas)}
              icon={Scale}
              accent={receitas - despesas >= 0 ? 'success' : 'destructive'}
              sub="O que sobra antes dos gastos variáveis"
              highlight
            />
            <StatCard
              label="Pausadas"
              value={String(pausadas)}
              icon={Pause}
              sub={pausadas ? 'Não geram previsão enquanto pausadas' : 'Nenhuma pausada'}
            />
          </div>

          <div role="radiogroup" aria-label="Filtrar" className="mb-4 inline-flex rounded-xl bg-muted p-1">
            {(
              [
                ['ativas', 'Ativas'],
                ['pausadas', 'Pausadas'],
                ['finalizadas', 'Finalizadas'],
                ['todas', 'Todas'],
              ] as [Filtro, string][]
            ).map(([f, rotulo]) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filtro === f}
                onClick={() => setFiltro(f)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                  filtro === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>

          {visiveis.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Nada nesse filtro.
            </p>
          ) : (
            <>
              {renderLista('entrada', 'Receitas', ArrowUpRight)}
              {renderLista('saida', 'Despesas', ArrowDownRight)}
            </>
          )}

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <CalendarCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Todo mês, cada recorrência ativa aparece em Lançamentos como “a confirmar”. Ao confirmar (pago ou
            recebido), vira um lançamento de verdade.
          </p>
        </>
      )}

      {/* Formulário */}
      {form && (
        <Modal open onClose={() => setForm(null)} title={editId ? 'Editar recorrência' : 'Nova recorrência'}>
          <form onSubmit={salvar} className="space-y-4">
            <div className="flex gap-2">
              {(['saida', 'entrada'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, tipo: t, item_id: '', budget_id: '' })}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
                    form.tipo === t
                      ? t === 'saida'
                        ? 'bg-destructive text-destructive-foreground'
                        : 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70',
                  )}
                >
                  {t === 'saida' ? 'Despesa' : 'Receita'}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rec-desc">Descrição</Label>
              <Input
                id="rec-desc"
                required
                placeholder={form.tipo === 'saida' ? 'Ex.: Aluguel, Academia' : 'Ex.: Salário'}
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rec-valor">{editId ? 'Valor inicial' : 'Valor'}</Label>
              <MoneyInput
                id="rec-valor"
                prefixo={simboloMoeda(form.moeda)}
                placeholder="0,00"
                value={form.valor}
                onValueChange={(v) => setForm({ ...form, valor: v })}
              />
              <div className="flex items-center justify-between gap-2">
                <MoedaToggle tamanho="sm" value={form.moeda} onChange={(m) => setForm({ ...form, moeda: m })} />
                {editId && (
                  <span className="text-xs text-muted-foreground">Pra mudar a partir de um mês, use Reajustar.</span>
                )}
              </div>
            </div>

            <div className={form.tipo === 'saida' ? 'grid grid-cols-2 gap-3' : 'grid gap-3'}>
              <div className="space-y-1.5">
                <Label htmlFor="rec-cat">Categoria</Label>
                <CategoriaSelect
                  id="rec-cat"
                  plano={plano}
                  tipo={form.tipo}
                  value={form.item_id}
                  onChange={(v) => setForm({ ...form, item_id: v })}
                />
              </div>
              {form.tipo === 'saida' && (
                <div className="space-y-1.5">
                  <Label htmlFor="rec-fatia">Fatia do orçamento</Label>
                  <Select
                    id="rec-fatia"
                    value={form.budget_id}
                    onChange={(e) => setForm({ ...form, budget_id: e.target.value })}
                  >
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

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rec-dia">Dia</Label>
                <NumberField id="rec-dia" casas={0} value={form.dia} onValueChange={(v) => setForm({ ...form, dia: v })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-inicio">Começa em</Label>
                <Input
                  id="rec-inicio"
                  type="month"
                  required
                  value={form.inicio}
                  onChange={(e) => setForm({ ...form, inicio: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-fim">Último mês</Label>
                <Input
                  id="rec-fim"
                  type="month"
                  min={form.inicio}
                  value={form.fim}
                  onChange={(e) => setForm({ ...form, fim: e.target.value })}
                />
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">Último mês vazio = sem data pra acabar.</p>

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando…' : editId ? 'Salvar' : 'Criar recorrência'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </PageLayout>
  )
}
