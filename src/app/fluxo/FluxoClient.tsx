'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  Wallet,
  Plus,
  Trash2,
  Pencil,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Upload,
} from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { MonthPicker } from '@/components/ui/month-picker'
import { hojeISO, formatData, fimDoMes, rotuloMes } from '@/lib/utils'
import {
  formatBRL,
  gerarParcelas,
  saldo,
  totalEntradas,
  totalSaidas,
  type Account,
  type Category,
  type Transaction,
} from '@/server/fluxo/fluxo.calc'
import { parseStatement, type ParsedItem } from '@/server/fluxo/statement'
import { usePromptDialog } from '@/components/ui/prompt'

const vazio = {
  tipo: 'saida' as 'entrada' | 'saida',
  valor: '',
  data: hojeISO(),
  descricao: '',
  category_id: '',
  account_id: '',
  recorrente: false,
  parcelado: false,
  parcelas: '2', // nº de parcelas quando 'parcelado' está ligado
}

export default function FluxoClient() {
  const router = useRouter()
  const ask = usePromptDialog()

  const [txs, setTxs] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)
  const [editId, setEditId] = useState<string | null>(null) // null = criando; id = editando
  const [f, setF] = useState({ ...vazio })

  // filtros da listagem — começa no mês atual (botão "Todo período" zera o filtro)
  const [fMes, setFMes] = useState(hojeISO().slice(0, 7)) // 'AAAA-MM' ou '' (todos)
  const [fTipo, setFTipo] = useState<'' | 'entrada' | 'saida'>('')

  // importação de fatura
  const [impAberto, setImpAberto] = useState(false)
  const [impItens, setImpItens] = useState<ParsedItem[]>([])
  const [impFormato, setImpFormato] = useState<string | null>(null)
  const [impConta, setImpConta] = useState('')
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

  // Cadastros (contas + categorias) carregam uma vez.
  const carregarCadastros = useCallback(async () => {
    try {
      const [a, c] = await Promise.all([api('/api/account'), api('/api/category')])
      setAccounts(a)
      setCategories(c)
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
      const t = await api('/api/transaction' + (qs ? `?${qs}` : ''))
      setTxs(t)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [api, fMes, fTipo])

  useEffect(() => {
    carregarCadastros()
  }, [carregarCadastros])

  useEffect(() => {
    carregarTx()
  }, [carregarTx])

  function abrirNovo() {
    setEditId(null)
    setF({ ...vazio })
    setErro(null)
    setAberto(true)
  }

  // Abre o mesmo modal, mas pré-preenchido pra editar um lançamento existente.
  function abrirEditar(t: Transaction) {
    setEditId(t.id)
    setF({
      tipo: t.tipo,
      valor: String(t.valor),
      data: t.data.slice(0, 10),
      descricao: t.descricao ?? '',
      category_id: t.category_id ?? '',
      account_id: t.account_id ?? '',
      recorrente: t.recorrente,
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
            data: f.data,
            descricao: f.descricao || null,
            category_id: f.category_id || null,
            account_id: f.account_id || null,
            recorrente: f.recorrente,
          }),
        })
      } else {
        const parcelar = f.tipo === 'saida' && f.parcelado && Number(f.parcelas) >= 2
        await api('/api/transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: f.tipo,
            valor: Number(f.valor),
            data: f.data,
            descricao: f.descricao || null,
            category_id: f.category_id || null,
            account_id: f.account_id || null,
            recorrente: parcelar ? false : f.recorrente,
            parcelas: parcelar ? Number(f.parcelas) : undefined,
          }),
        })
      }
      setAberto(false)
      await carregarTx()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function criarCategoria() {
    const v = await ask({
      title: `Nova categoria de ${f.tipo === 'entrada' ? 'entrada' : 'saída'}`,
      fields: [{ name: 'name', label: 'Nome da categoria', placeholder: 'Mercado, Salário…' }],
    })
    if (!v?.name) return
    const nova = await api('/api/category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: v.name, tipo: f.tipo }),
    })
    await carregarCadastros()
    set('category_id', nova.id)
  }

  async function criarConta() {
    const v = await ask({
      title: 'Nova conta/cartão',
      fields: [{ name: 'name', label: 'Nome', placeholder: 'Cartão XP, Pix…' }],
    })
    if (!v?.name) return
    const nova = await api('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: v.name }),
    })
    await carregarCadastros()
    set('account_id', nova.id)
  }

  async function excluir(t: Transaction) {
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
    if (!confirm('Excluir este lançamento?')) return
    await api(`/api/transaction/${t.id}`, { method: 'DELETE' })
    await carregarTx()
  }

  function abrirImport() {
    setImpItens([])
    setImpFormato(null)
    setImpConta('')
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
        body: JSON.stringify({ account_id: impConta || null, itens: impItens }),
      })
      setImpResumo(`✅ ${r.importados} importados · ${r.ignorados} já existiam.`)
      setImpItens([])
      await carregarTx()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  const nomeCategoria = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? null
  const nomeConta = (id: string | null) =>
    accounts.find((a) => a.id === id)?.name ?? '—'

  const categoriasDoTipo = useMemo(
    () => categories.filter((c) => c.tipo === f.tipo),
    [categories, f.tipo],
  )

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

  const resultado = saldo(txs)
  const temFiltro = Boolean(fMes || fTipo)

  return (
    <PageLayout
      title="Fluxo de Caixa"
      description="Entradas e saídas do seu dinheiro"
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
          {fMes ? `📅 ${rotuloMes(fMes)}` : '📅 Todo o período'} · {txs.length} lançamento
          {txs.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* KPIs (refletem o filtro) */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Entradas"
          value={formatBRL(totalEntradas(txs))}
          icon={ArrowUpRight}
          accent="success"
        />
        <StatCard
          label="Saídas"
          value={formatBRL(totalSaidas(txs))}
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
      {txs.length === 0 ? (
        <EmptyState
          emoji="🧾"
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
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Conta</th>
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
                      {nomeCategoria(t.category_id) ?? 'sem categoria'}
                      {t.recorrente && <Badge variant="secondary">fixo</Badge>}
                      {t.parcela_total && (
                        <Badge variant="secondary">
                          💳 {t.parcela_num}/{t.parcela_total}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{nomeConta(t.account_id)}</td>
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
                    {t.tipo === 'entrada' ? '+' : '−'} {formatBRL(Number(t.valor))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => abrirEditar(t)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => excluir(t)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Modal de novo lançamento / edição */}
      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title={editId ? 'Editar lançamento ✏️' : 'Novo lançamento 🧾'}
      >
        <form onSubmit={lancar} className="space-y-4">
          {/* Tipo */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                set('tipo', 'saida')
                set('category_id', '')
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${f.tipo === 'saida' ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
            >
              ↓ Saída
            </button>
            <button
              type="button"
              onClick={() => {
                set('tipo', 'entrada')
                set('category_id', '')
                set('parcelado', false)
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${f.tipo === 'entrada' ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
            >
              ↑ Entrada
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="valor">Valor (R$) *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={f.valor}
                onChange={(e) => set('valor', e.target.value)}
                required
                autoFocus
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

          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição</Label>
            <Input
              id="desc"
              placeholder="Ex: Mercado da semana, Salário"
              value={f.descricao}
              onChange={(e) => set('descricao', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <div className="flex gap-1">
                <Select
                  value={f.category_id}
                  onChange={(e) => set('category_id', e.target.value)}
                >
                  <option value="">(sem categoria)</option>
                  {categoriasDoTipo.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={criarCategoria}>
                  <Plus />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Conta</Label>
              <div className="flex gap-1">
                <Select
                  value={f.account_id}
                  onChange={(e) => set('account_id', e.target.value)}
                >
                  <option value="">(sem conta)</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={criarConta}>
                  <Plus />
                </Button>
              </div>
            </div>
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
                Compra parcelada 💳
              </label>

              {f.parcelado && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="parcelas" className="text-sm">
                      Em
                    </Label>
                    <Input
                      id="parcelas"
                      type="number"
                      min="2"
                      max="72"
                      className="w-20"
                      value={f.parcelas}
                      onChange={(e) => set('parcelas', e.target.value)}
                    />
                    <span className="text-sm text-muted-foreground">parcelas (o valor é o total)</span>
                  </div>
                  {previewParcelas && (
                    <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                      {previewParcelas.n}x de{' '}
                      <strong className="text-foreground">{formatBRL(previewParcelas.valor)}</strong> ·{' '}
                      {previewParcelas.primeira} → {previewParcelas.ultima}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {!f.parcelado && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={f.recorrente}
                onChange={(e) => set('recorrente', e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              Gasto fixo / recorrente 📌
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
      <Modal open={impAberto} onClose={() => setImpAberto(false)} title="Importar fatura 📄">
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
                <Label>Lançar na conta</Label>
                <Select value={impConta} onChange={(e) => setImpConta(e.target.value)}>
                  <option value="">(sem conta)</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
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
