'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Check, Loader2, Search, TriangleAlert } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { MoneyInput } from '@/components/ui/money-input'
import { NumberField } from '@/components/ui/number-field'
import { cn } from '@/lib/utils'
import { formatBRL } from '@/server/fluxo/fluxo.calc'
import type { AtivoB3 } from '@/server/cotacao'

export type TipoAtivo = 'acao' | 'fii'
export type NovoAtivo = { ticker: string; quantidade: number; preco_medio: number }

const ROTULO: Record<TipoAtivo, string> = { acao: 'ação', fii: 'FII' }

/**
 * Cadastro de Ação/FII com BUSCA: enquanto digita o código, sugere ativos da
 * B3 (nome + preço atual) e mostra claramente qual foi encontrado — pra não
 * cadastrar o ticker errado. Avisa se o tipo não bate (FII na tela de ações…).
 */
export function NovoAtivoDialog({
  open,
  tipo,
  titulo,
  qtdLabel,
  exemplo,
  onClose,
  onSalvar,
}: {
  open: boolean
  tipo: TipoAtivo
  titulo: string
  qtdLabel: string
  exemplo: string
  onClose: () => void
  onSalvar: (a: NovoAtivo) => Promise<void>
}) {
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<AtivoB3[]>([])
  const [buscouPor, setBuscouPor] = useState('')
  const [escolhido, setEscolhido] = useState<AtivoB3 | null>(null)
  const [qtd, setQtd] = useState('')
  const [preco, setPreco] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const codigo = termo.trim().toUpperCase()
  const buscando = codigo.length >= 3 && buscouPor !== codigo && !escolhido

  // Busca com atraso (debounce) — o estado só muda quando a resposta chega.
  useEffect(() => {
    if (!open || codigo.length < 3 || escolhido) return
    let vivo = true
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ativos/busca?q=${encodeURIComponent(codigo)}`)
        const lista = res.ok ? ((await res.json()) as AtivoB3[]) : []
        if (!vivo) return
        setResultados(lista)
        setBuscouPor(codigo)
        // Código digitado inteiro e existente -> já confirma sozinho.
        const exato = lista.find((a) => a.ticker === codigo)
        if (exato) setEscolhido(exato)
      } catch {
        if (vivo) setBuscouPor(codigo)
      }
    }, 350)
    return () => {
      vivo = false
      clearTimeout(t)
    }
  }, [codigo, open, escolhido])

  function fechar() {
    setTermo('')
    setResultados([])
    setBuscouPor('')
    setEscolhido(null)
    setQtd('')
    setPreco('')
    setErro(null)
    onClose()
  }

  function escolher(a: AtivoB3) {
    setEscolhido(a)
    setTermo(a.ticker)
  }

  const naoAchou = codigo.length >= 3 && buscouPor === codigo && !escolhido
  const tipoErrado = escolhido && (tipo === 'fii' ? !escolhido.fii : escolhido.fii)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!codigo) return setErro('Informe o código')
    if (
      !escolhido &&
      !confirm(`Não encontramos "${codigo}" na B3. Cadastrar mesmo assim? (sem cotação ao vivo, se o código estiver errado)`)
    )
      return
    setSalvando(true)
    setErro(null)
    try {
      await onSalvar({ ticker: codigo, quantidade: Number(qtd) || 0, preco_medio: Number(preco) || 0 })
      fechar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={open} onClose={fechar} title={titulo}>
      <form onSubmit={enviar} className="space-y-4">
        {/* Código + busca */}
        <div className="space-y-1.5">
          <Label htmlFor="ativo-codigo">Código ({ROTULO[tipo]})</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="ativo-codigo"
              autoFocus
              autoComplete="off"
              placeholder={`Ex.: ${exemplo} — ou parte do nome`}
              className="pl-9 uppercase placeholder:normal-case"
              value={termo}
              onChange={(e) => {
                setTermo(e.target.value)
                setEscolhido(null)
              }}
            />
            {buscando && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Confirmação do ativo encontrado */}
          {escolhido && (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-600/25 bg-emerald-50 p-3 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <div className="min-w-0">
                <div className="font-semibold text-emerald-900">
                  Encontrado: {escolhido.ticker}
                  {escolhido.preco !== null && (
                    <span className="font-normal text-emerald-800"> · {formatBRL(escolhido.preco)} agora</span>
                  )}
                </div>
                <div className="truncate text-emerald-900/80" title={escolhido.nome}>
                  {escolhido.nome}
                </div>
                <div className="text-xs text-emerald-900/60">
                  {escolhido.descricao} · {escolhido.fii ? 'Fundo imobiliário' : 'Ação'}
                </div>
              </div>
            </div>
          )}
          {tipoErrado && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <TriangleAlert className="h-3.5 w-3.5" />
              Esse código parece ser {escolhido!.fii ? 'um FII' : 'uma ação'}, não {tipo === 'fii' ? 'um FII' : 'uma ação'}.
              Confira se está na tela certa.
            </p>
          )}

          {/* Sugestões */}
          {!escolhido && codigo.length >= 3 && buscouPor === codigo && resultados.length > 0 && (
            <ul className="max-h-60 overflow-y-auto rounded-lg border border-border">
              {resultados.map((a) => (
                <li key={a.ticker}>
                  <button
                    type="button"
                    onClick={() => escolher(a)}
                    className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-muted"
                  >
                    <span className="w-16 shrink-0 font-semibold">{a.ticker}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{a.nome}</span>
                      <span className="block truncate text-xs text-muted-foreground">{a.descricao}</span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        a.fii ? 'bg-sky-50 text-sky-700' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {a.fii ? 'FII' : 'Ação'}
                    </span>
                    {a.preco !== null && (
                      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {formatBRL(a.preco)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {naoAchou && resultados.length === 0 && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
              <TriangleAlert className="h-3.5 w-3.5" />
              Não encontramos &quot;{codigo}&quot; na B3. Confira o código.
            </p>
          )}
          {codigo.length > 0 && codigo.length < 3 && (
            <p className="text-xs text-muted-foreground">Digite pelo menos 3 letras pra buscar.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ativo-qtd">{qtdLabel}</Label>
            <NumberField id="ativo-qtd" casas={4} placeholder="0" value={qtd} onValueChange={setQtd} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ativo-preco">Preço médio</Label>
            <MoneyInput id="ativo-preco" prefixo="R$" placeholder="0,00" value={preco} onValueChange={setPreco} />
          </div>
        </div>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={fechar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando || !codigo}>
            {salvando ? 'Salvando…' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
