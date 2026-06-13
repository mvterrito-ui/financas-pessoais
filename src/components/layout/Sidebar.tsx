'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Wallet,
  PieChart,
  TrendingUp,
  Bitcoin,
  Building2,
  Landmark,
  Sparkles,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface Item {
  to: string
  label: string
  icon: LucideIcon
  emoji: string
  breve?: boolean
}
interface Secao {
  titulo: string
  itens: Item[]
}

const secoes: Secao[] = [
  {
    titulo: 'Geral',
    itens: [{ to: '/', label: 'Visão geral', icon: LayoutDashboard, emoji: '🏠' }],
  },
  {
    titulo: 'Caixa',
    itens: [
      { to: '/fluxo', label: 'Fluxo de Caixa', icon: Wallet, emoji: '💸' },
      { to: '/orcamento', label: 'Orçamento', icon: PieChart, emoji: '🎯' },
    ],
  },
  {
    titulo: 'Investimentos',
    itens: [
      { to: '/patrimonio', label: 'Patrimônio', icon: TrendingUp, emoji: '📈' },
      { to: '/projecao', label: 'Projeção', icon: Sparkles, emoji: '🔮' },
      { to: '/fii', label: 'FIIs', icon: Building2, emoji: '🏢' },
      { to: '/renda-fixa', label: 'Renda Fixa', icon: Landmark, emoji: '🏦' },
      { to: '/cripto', label: 'Cripto', icon: Bitcoin, emoji: '🪙' },
    ],
  },
]

function iniciais(nome?: string | null): string {
  if (!nome) return '🙂'
  const p = nome.trim().split(/\s+/)
  const i = (p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : (p[0]?.[1] ?? ''))
  return i.toUpperCase()
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [nome, setNome] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setNome((user?.user_metadata?.name as string) ?? null)
      setEmail(user?.email ?? null)
    })
  }, [supabase])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      {/* Marca */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-accent/20 text-xl">
          💰
        </span>
        <div className="leading-tight">
          <div className="text-base font-semibold tracking-tight text-white">Finanças</div>
          <div className="text-[11px] text-sidebar-foreground/50">Suas finanças pessoais</div>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-3">
        {secoes.map((secao) => (
          <div key={secao.titulo}>
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
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
                    className={cn(
                      'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      ativo
                        ? 'bg-white/10 text-white'
                        : 'text-sidebar-foreground/75 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    {ativo && (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-accent" />
                    )}
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        ativo
                          ? 'text-sidebar-accent'
                          : 'text-sidebar-foreground/60 group-hover:text-white',
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
      <div className="border-t border-white/10 p-3">
        <div className="mb-1 flex items-center gap-3 rounded-md px-2 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-white">
            {iniciais(nome)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">{nome ?? 'Usuário'}</div>
            <div className="truncate text-[11px] text-sidebar-foreground/50">{email}</div>
          </div>
        </div>
        <button
          onClick={sair}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
