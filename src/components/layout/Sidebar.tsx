'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Wallet,
  PieChart,
  TrendingUp,
  Bitcoin,
  Building2,
  CandlestickChart,
  Landmark,
  Sparkles,
  BarChart3,
  CalendarRange,
  Handshake,
  LogOut,
  Pencil,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { expiraEmMs } from '@/lib/sessao'
import { TemaToggle } from './TemaToggle'
import { Marca } from './Marca'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface Item {
  to: string
  label: string
  icon: LucideIcon
  breve?: boolean
}
interface Secao {
  titulo: string
  itens: Item[]
}

const secoes: Secao[] = [
  {
    titulo: 'Geral',
    itens: [{ to: '/', label: 'Visão geral', icon: LayoutDashboard }],
  },
  {
    titulo: 'Caixa',
    itens: [
      { to: '/fluxo', label: 'Fluxo de Caixa', icon: Wallet },
      { to: '/orcamento', label: 'Orçamento', icon: PieChart },
      { to: '/anual', label: 'Controle Anual', icon: CalendarRange },
      { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
    ],
  },
  {
    titulo: 'Patrimônio',
    itens: [
      { to: '/patrimonio', label: 'Patrimônio', icon: TrendingUp },
      { to: '/projecao', label: 'Projeção', icon: Sparkles },
    ],
  },
  {
    titulo: 'Investimentos',
    itens: [
      { to: '/acoes', label: 'Ações', icon: CandlestickChart },
      { to: '/fii', label: 'FIIs', icon: Building2 },
      { to: '/renda-fixa', label: 'Renda Fixa', icon: Landmark },
      { to: '/cripto', label: 'Cripto', icon: Bitcoin },
      { to: '/consorcios', label: 'Consórcios', icon: Handshake },
    ],
  },
]

function iniciais(nome?: string | null): string {
  if (!nome) return '?'
  const p = nome.trim().split(/\s+/)
  const i = (p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : (p[0]?.[1] ?? ''))
  return i.toUpperCase()
}

export function Sidebar({ aberto = false, onFechar }: { aberto?: boolean; onFechar?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [nome, setNome] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroNome, setErroNome] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setNome((user?.user_metadata?.name as string) ?? null)
      setEmail(user?.email ?? null)
    })
  }, [supabase])

  // Logout automático 12h após o login — cobre a aba parada aberta (o
  // proxy.ts já barra qualquer requisição depois disso).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    supabase.auth.getSession().then(({ data: { session } }) => {
      const expira = expiraEmMs(session?.access_token)
      if (expira === null) return
      timer = setTimeout(
        async () => {
          await supabase.auth.signOut()
          router.push('/login?expirou=1')
        },
        Math.max(0, expira - Date.now()),
      )
    })
    return () => clearTimeout(timer)
  }, [supabase, router])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function abrirPerfil() {
    setNovoNome(nome ?? '')
    setErroNome(null)
    setEditando(true)
  }

  async function salvarNome(e: FormEvent) {
    e.preventDefault()
    const n = novoNome.trim()
    if (!n) return setErroNome('Informe um nome')
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ data: { name: n } })
    setSalvando(false)
    if (error) return setErroNome(error.message)
    setNome(n)
    setEditando(false)
  }

  return (
    <>
      {/* Celular: fundo escuro atrás da gaveta (toque fecha) */}
      {aberto && (
        <div className="fixed inset-0 z-40 bg-slate-950/50 md:hidden" onClick={onFechar} aria-hidden />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-200',
          'md:relative md:z-auto md:w-64 md:translate-x-0 md:shadow-none',
          aberto ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brilho esmeralda no topo (mesma linguagem do login) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64"
          style={{ background: 'radial-gradient(90% 70% at 10% 0%, rgba(52,211,153,0.16), transparent 70%)' }}
        />

        {/* Marca */}
        <div className="relative flex items-center gap-3 px-5 pb-6 pt-6">
          <Marca tamanho={40} className="rounded-xl ring-1 ring-white/15" />
          <div className="leading-tight">
            <div className="text-base font-semibold tracking-tight text-white">Finanças</div>
            <div className="text-[11px] text-sidebar-foreground/55">Seu dinheiro, mês a mês</div>
          </div>
        </div>

        {/* Navegação */}
        <nav className="relative flex-1 space-y-5 overflow-y-auto px-3 pb-3">
          {secoes.map((secao) => (
            <div key={secao.titulo}>
              <div className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40">
                {secao.titulo}
              </div>
              <div className="space-y-0.5">
                {secao.itens.map(({ to, label, icon: Icon, breve }) => {
                  const ativo = pathname === to
                  if (breve) {
                    return (
                      <div
                        key={to}
                        className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/35"
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                        <span className="ml-auto rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wide">
                          breve
                        </span>
                      </div>
                    )
                  }
                  return (
                    <Link
                      key={to}
                      href={to}
                      onClick={onFechar}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                        ativo
                          ? 'bg-gradient-to-r from-emerald-400/15 to-emerald-400/[0.03] text-white ring-1 ring-inset ring-emerald-300/15'
                          : 'text-sidebar-foreground/70 hover:bg-white/[0.06] hover:text-white',
                      )}
                    >
                      {ativo && (
                        <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-accent shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                      )}
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          ativo
                            ? 'text-emerald-300'
                            : 'text-sidebar-foreground/50 group-hover:text-white',
                        )}
                      />
                      {label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Usuário + sair */}
        <div className="relative space-y-2 border-t border-white/10 p-3">
          <TemaToggle />
          <button
            onClick={abrirPerfil}
            title="Editar perfil"
            className="group mb-1 flex w-full items-center gap-3 rounded-xl bg-white/[0.04] px-2.5 py-2.5 text-left ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.08]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#34d399] to-[#059669] text-xs font-semibold text-white shadow-md shadow-emerald-900/40">
              {iniciais(nome)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{nome ?? 'Usuário'}</div>
              <div className="truncate text-[11px] text-sidebar-foreground/50">{email}</div>
            </div>
            <Pencil className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
          <button
            onClick={sair}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/60 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>

      </aside>

      <Modal open={editando} onClose={() => setEditando(false)} title="Seu perfil">
        <form onSubmit={salvarNome} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="perfil-nome">Nome</Label>
            <Input
              id="perfil-nome"
              autoFocus
              maxLength={60}
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input value={email ?? ''} disabled />
          </div>
          {erroNome && <p className="text-sm text-destructive">{erroNome}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
