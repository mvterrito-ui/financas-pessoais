'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Car,
  CalendarClock,
  CheckCircle2,
  Handshake,
  House,
  KeyRound,
  Package,
  Pencil,
  Plus,
  Trash2,
  Wallet,
  Hourglass,
  TrendingUp,
  X,
  type LucideIcon,
} from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NumberCommit } from '@/components/ui/number-field'
import { usePromptDialog } from '@/components/ui/prompt'
import { invalidarSincronizacao } from '@/lib/sincronizar'
import { cn } from '@/lib/utils'
import { formatBRL } from '@/server/fluxo/fluxo.calc'
import {
  faixasDeParcela,
  faltaPagar,
  faltamParcelas,
  pagoEstimado,
  parcelaAtual,
  pctQuitado,
  totais,
  type Consorcio,
  type Reajuste,
  type StatusConsorcio,
  type TipoConsorcio,
} from '@/server/consorcio/consorcio.calc'

const TIPOS: Record<TipoConsorcio, { label: string; icon: LucideIcon }> = {
  imovel: { label: 'Imóvel', icon: House },
  veiculo: { label: 'Veículo', icon: Car },
  servico: { label: 'Serviço', icon: KeyRound },
  outro: { label: 'Outro', icon: Package },
}
const STATUS: Record<StatusConsorcio, { label: string; selo: string }> = {
  ativo: { label: 'Em andamento', selo: 'bg-sky-50 text-sky-700 ring-sky-600/20' },
  contemplado: { label: 'Contemplado', selo: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  encerrado: { label: 'Encerrado', selo: 'bg-muted text-muted-foreground ring-border' },
}
const opcoes = <T extends string>(r: Record<T, { label: string }>) =>
  (Object.keys(r) as T[]).map((k) => ({ value: k, label: r[k].label }))

export default function ConsorcioClient() {
  const router = useRouter()
  const ask = usePromptDialog()
  const [lista, setLista] = useState<Consorcio[]>([])
  const [reajustes, setReajustes] = useState<Reajuste[]>([])
  const [carregado, setCarregado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const api = useCallback(
    async (url: string, init?: RequestInit) => {
      // Mexeu num consórcio -> o Patrimônio (valor pago) sincroniza na próxima visita.
      if (init?.method && init.method !== 'GET') invalidarSincronizacao()
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

  const buscar = useCallback(
    () =>
      Promise.all([
        api('/api/consorcio') as Promise<Consorcio[]>,
        api('/api/consorcio/reajuste') as Promise<Reajuste[]>,
      ]),
    [api],
  )
  const aplicar = ([l, r]: [Consorcio[], Reajuste[]]) => {
    setLista(l)
    setReajustes(r)
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

  const patch = (id: string, dados: Record<string, unknown>) =>
    acao(() =>
      api(`/api/consorcio/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      }),
    )

  // Formulário (novo e editar): mesmos campos; no editar já vem preenchido.
  const campos = (c?: Consorcio) => [
    { name: 'nome', label: 'Nome', placeholder: 'Ex.: Carro, Apartamento', valor: c?.nome },
    { name: 'administradora', label: 'Administradora (opcional)', placeholder: 'Ex.: Porto, Embracon', valor: c?.administradora ?? '' },
    { name: 'tipo', label: 'Tipo do bem', type: 'select' as const, options: opcoes(TIPOS), valor: c?.tipo },
    { name: 'valor_carta', label: 'Valor da carta de crédito', type: 'money' as const, prefixo: 'R$', valor: c ? String(c.valor_carta) : undefined },
    { name: 'prazo_meses', label: 'Prazo total', type: 'number' as const, casas: 0, sufixo: 'meses', valor: c ? String(c.prazo_meses) : undefined },
    { name: 'parcelas_pagas', label: 'Parcelas já pagas', type: 'number' as const, casas: 0, valor: c ? String(c.parcelas_pagas) : undefined },
    { name: 'valor_parcela', label: 'Valor da 1ª parcela (ou a atual, se não souber o histórico)', type: 'money' as const, prefixo: 'R$', valor: c ? String(c.valor_parcela) : undefined },
    { name: 'status', label: 'Situação', type: 'select' as const, options: opcoes(STATUS), valor: c?.status },
  ]
  const corpo = (v: Record<string, string>) => ({
    nome: v.nome,
    administradora: v.administradora || null,
    tipo: v.tipo,
    valor_carta: Number(v.valor_carta) || 0,
    prazo_meses: Number(v.prazo_meses) || 1,
    parcelas_pagas: Number(v.parcelas_pagas) || 0,
    valor_parcela: Number(v.valor_parcela) || 0,
    status: v.status,
  })

  async function novo() {
    const v = await ask({ title: 'Novo consórcio', fields: campos() })
    if (!v?.nome) return
    acao(() =>
      api('/api/consorcio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo(v)),
      }),
    )
  }

  async function editar(c: Consorcio) {
    const v = await ask({ title: `Editar ${c.nome}`, submitLabel: 'Salvar', fields: campos(c) })
    if (!v?.nome) return
    patch(c.id, corpo(v))
  }

  // Reajuste: "a partir da parcela nº X, a parcela passa a ser R$ Y".
  async function reajustar(c: Consorcio) {
    const v = await ask({
      title: `Reajuste da parcela · ${c.nome}`,
      submitLabel: 'Salvar reajuste',
      fields: [
        {
          name: 'a_partir_parcela',
          label: `A partir da parcela nº (de 1 a ${c.prazo_meses})`,
          type: 'number',
          casas: 0,
          valor: String(Math.min(c.parcelas_pagas + 1, c.prazo_meses)),
        },
        {
          name: 'valor_parcela',
          label: 'Novo valor da parcela',
          type: 'money',
          prefixo: 'R$',
          valor: String(parcelaAtual(c, reajustes)),
        },
      ],
    })
    if (!v?.a_partir_parcela) return
    acao(() =>
      api('/api/consorcio/reajuste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consorcio_id: c.id,
          a_partir_parcela: Number(v.a_partir_parcela),
          valor_parcela: Number(v.valor_parcela) || 0,
        }),
      }),
    )
  }

  function removerReajuste(r: Reajuste) {
    if (!confirm(`Remover o reajuste a partir da parcela ${r.a_partir_parcela}?`)) return
    acao(() => api(`/api/consorcio/reajuste/${r.id}`, { method: 'DELETE' }))
  }

  function remover(c: Consorcio) {
    if (!confirm(`Remover o consórcio "${c.nome}"?`)) return
    acao(() => api(`/api/consorcio/${c.id}`, { method: 'DELETE' }))
  }

  const t = totais(lista, reajustes)

  return (
    <PageLayout
      title="Consórcios"
      description="Cartas de crédito, parcelas e quanto falta"
      icon={Handshake}
      actions={
        <Button onClick={novo}>
          <Plus /> Novo consórcio
        </Button>
      }
    >
      {erro && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
      )}

      {carregado && lista.length === 0 ? (
        <EmptyState
          icon={Handshake}
          titulo="Nenhum consórcio ainda"
          descricao="Cadastre suas cotas: valor da carta, prazo, parcelas pagas e o valor da parcela. O app calcula quanto já foi e quanto falta."
          acao={
            <Button onClick={novo}>
              <Plus /> Novo consórcio
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Cartas de crédito"
              value={formatBRL(t.cartas)}
              icon={Handshake}
              sub={t.contemplados ? `${t.contemplados} contemplado${t.contemplados > 1 ? 's' : ''}` : 'Sem contemplação ainda'}
              highlight
            />
            <StatCard
              label="Parcelas por mês"
              value={formatBRL(t.parcelaMensal)}
              icon={CalendarClock}
              sub={`${t.emAndamento} em andamento`}
            />
            <StatCard label="Já pago" value={formatBRL(t.pago)} icon={Wallet} sub="Também aparece no Patrimônio" />
            <StatCard label="Falta pagar (estimado)" value={formatBRL(t.falta)} icon={Hourglass} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {lista.map((c) => {
              const tipo = TIPOS[c.tipo] ?? TIPOS.outro
              const Icon = tipo.icon
              const pct = pctQuitado(c)
              const quitado = faltamParcelas(c) === 0
              return (
                <Card key={c.id} className="flex flex-col p-4">
                  {/* Cabeçalho */}
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold" title={c.nome}>
                        {c.nome}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[tipo.label, c.administradora].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="flex shrink-0">
                      <button
                        type="button"
                        onClick={() => editar(c)}
                        aria-label={`Editar ${c.nome}`}
                        title="Editar"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remover(c)}
                        aria-label={`Remover ${c.nome}`}
                        title="Remover"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Carta + situação */}
                  <div className="mt-4 flex items-end justify-between gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Carta de crédito</div>
                      <div className="text-xl font-semibold tabular-nums tracking-tight">
                        {formatBRL(Number(c.valor_carta))}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
                        quitado && c.status !== 'encerrado'
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                          : STATUS[c.status].selo,
                      )}
                    >
                      {(c.status === 'contemplado' || quitado) && <CheckCircle2 className="h-3 w-3" />}
                      {quitado && c.status !== 'encerrado' ? 'Quitado' : STATUS[c.status].label}
                    </span>
                  </div>

                  {/* Progresso */}
                  <div className="mt-4">
                    <div
                      className="h-2 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={Math.round(pct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${c.nome}: ${Math.round(pct)}% quitado`}
                    >
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                      <span>
                        {c.parcelas_pagas} de {c.prazo_meses} parcelas
                      </span>
                      <span className="font-medium text-foreground">
                        {pct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
                      </span>
                    </div>
                  </div>

                  {/* Edição rápida */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Parcela atual</Label>
                      <div className="flex gap-1.5">
                        <div className="flex h-9 min-w-0 flex-1 items-center justify-end rounded-lg border border-input bg-muted/40 px-2.5 text-sm font-semibold tabular-nums">
                          {formatBRL(parcelaAtual(c, reajustes))}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => reajustar(c)}
                          aria-label={`Reajustar a parcela de ${c.nome}`}
                          title="Reajustar parcela"
                        >
                          <TrendingUp />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Pagas</Label>
                      <div className="flex gap-1.5">
                        <NumberCommit
                          casas={0}
                          aria-label={`Parcelas pagas de ${c.nome}`}
                          className="min-w-0 flex-1"
                          inicial={c.parcelas_pagas}
                          onCommit={(v) => patch(c.id, { parcelas_pagas: Math.min(c.prazo_meses, Number(v) || 0) })}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          disabled={quitado || c.status === 'encerrado'}
                          onClick={() => patch(c.id, { parcelas_pagas: c.parcelas_pagas + 1 })}
                          aria-label={`Marcar mais uma parcela paga em ${c.nome}`}
                          title="+1 parcela paga"
                        >
                          <Plus />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Histórico da parcela (só aparece se houver reajuste) */}
                  {(() => {
                    const faixas = faixasDeParcela(c, reajustes)
                    if (faixas.length < 2) return null
                    return (
                      <div className="mt-3 rounded-xl bg-muted/50 p-2.5">
                        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Histórico da parcela
                        </div>
                        <ul className="space-y-1 text-xs">
                          {faixas.map((f) => (
                            <li key={f.de} className="flex items-center gap-2">
                              <span className="w-24 shrink-0 text-muted-foreground">
                                {f.ate === null ? `${f.de}ª em diante` : `${f.de}ª–${f.ate}ª`}
                              </span>
                              <span className="font-medium tabular-nums">{formatBRL(f.valor)}</span>
                              {f.variacaoPct !== null && (
                                <span className="tabular-nums text-muted-foreground">
                                  {f.variacaoPct >= 0 ? '+' : ''}
                                  {f.variacaoPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                                </span>
                              )}
                              {f.reajuste && (
                                <button
                                  type="button"
                                  onClick={() => removerReajuste(f.reajuste!)}
                                  aria-label={`Remover reajuste da parcela ${f.de}`}
                                  title="Remover reajuste"
                                  className="ml-auto flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })()}

                  {/* Rodapé */}
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">Já pago</div>
                      <div className="font-semibold tabular-nums">{formatBRL(pagoEstimado(c, reajustes))}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-muted-foreground">Falta ≈</div>
                      <div className="font-semibold tabular-nums">{formatBRL(faltaPagar(c, reajustes))}</div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            “Já pago” soma cada parcela pelo valor da época. Quando a parcela for reajustada, registre no
            botão Reajustar parcela do card. “Falta” é estimado pela parcela atual.
          </p>
        </>
      )}
    </PageLayout>
  )
}
