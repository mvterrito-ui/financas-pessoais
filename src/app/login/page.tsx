'use client'

import { Suspense, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  CalendarRange,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// Mensagens do Supabase Auth em português (o resto cai numa genérica).
function traduzirErro(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(msg)) return 'Este e-mail ainda não foi confirmado.'
  if (/too many requests|rate limit/i.test(msg)) return 'Muitas tentativas. Espere um pouco e tente de novo.'
  if (/fetch|network/i.test(msg)) return 'Sem conexão. Confira a internet e tente de novo.'
  return 'Não foi possível entrar. Tente de novo.'
}

// Aviso quando o logout automático (12h) trouxe o usuário de volta pra cá.
// useSearchParams exige Suspense numa página estática.
function AvisoExpirou() {
  const params = useSearchParams()
  if (params.get('expirou') !== '1') return null
  return (
    <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
      <Lock className="mt-0.5 h-4 w-4 shrink-0" />
      <span>Sua sessão expirou depois de 12 horas. Entre de novo pra continuar.</span>
    </div>
  )
}

const DESTAQUES = [
  { icon: Wallet, titulo: 'Fluxo de caixa', texto: 'Entradas, saídas, parcelas e faturas importadas.' },
  { icon: TrendingUp, titulo: 'Patrimônio e investimentos', texto: 'Ações, FIIs, renda fixa e cripto com cotação ao vivo.' },
  { icon: CalendarRange, titulo: 'Controle anual', texto: 'O ano inteiro mês a mês, com saldo e gráficos.' },
]

// Prévia decorativa do app (sem dados reais) — só ilustração.
function PreviaApp() {
  const barras = [38, 46, 42, 55, 51, 63, 60, 72, 69, 80, 78, 92]
  return (
    <div aria-hidden className="relative">
      <div className="absolute -inset-6 rounded-[2rem] bg-emerald-400/10 blur-2xl" />
      <div className="relative rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-md">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-sidebar-foreground/60">Patrimônio</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-white">R$ ••••••</p>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-1 text-xs font-semibold text-emerald-300">
            <TrendingUp className="h-3 w-3" /> no ano
          </span>
        </div>
        <div className="mt-5 flex h-24 items-end gap-1.5">
          {barras.map((h, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 rounded-t-[4px]',
                i === barras.length - 1 ? 'bg-emerald-300' : 'bg-emerald-400/35',
              )}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    try {
      // Só login: o cadastro é fechado (contas são criadas pelo admin).
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
      if (error) throw error
      router.refresh()
      router.push('/')
    } catch (err) {
      setErro(traduzirErro((err as Error).message ?? ''))
      setCarregando(false)
    }
  }

  return (
    <main className="flex min-h-dvh bg-background">
      {/* ===== Painel da marca (desktop) ===== */}
      <section className="relative hidden w-[46%] max-w-2xl flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex xl:p-16">
        {/* Fundo: brilho esmeralda + grade sutil */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 15% 10%, rgba(52,211,153,0.18), transparent 70%), radial-gradient(50% 40% at 90% 85%, rgba(5,150,105,0.22), transparent 70%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />

        <div className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl ring-1 ring-white/15">
            💰
          </span>
          <span className="text-lg font-semibold tracking-tight text-white">Finanças</span>
        </div>

        <div className="relative space-y-10">
          <div className="space-y-4">
            <h1 className="max-w-md text-4xl font-semibold leading-[1.1] tracking-tight text-white xl:text-5xl">
              Seu dinheiro, mês a mês, num lugar só.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-sidebar-foreground/75">
              Gastos, investimentos e patrimônio organizados — pra decidir com clareza, não no
              escuro.
            </p>
          </div>

          <div className="max-w-md">
            <PreviaApp />
          </div>

          <ul className="max-w-md space-y-4">
            {DESTAQUES.map(({ icon: Icon, titulo, texto }) => (
              <li key={titulo} className="flex gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-300/20">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-white">{titulo}</span>
                  <span className="block text-sm text-sidebar-foreground/65">{texto}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-xs text-sidebar-foreground/50">
          <ShieldCheck className="h-3.5 w-3.5" />
          Acesso restrito · seus dados ficam isolados da conta de qualquer outra pessoa
        </p>
      </section>

      {/* ===== Formulário ===== */}
      <section className="flex flex-1 flex-col">
        {/* Faixa da marca (celular/tablet) */}
        <div className="relative overflow-hidden bg-sidebar px-6 pb-10 pt-8 lg:hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(70% 90% at 20% 0%, rgba(52,211,153,0.22), transparent 70%)' }}
          />
          <div className="relative flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl ring-1 ring-white/15">
              💰
            </span>
            <div>
              <p className="text-lg font-semibold leading-tight tracking-tight text-white">Finanças</p>
              <p className="text-xs text-sidebar-foreground/70">Seu dinheiro, mês a mês, num lugar só.</p>
            </div>
          </div>
        </div>

        <div className="-mt-5 flex flex-1 items-start justify-center px-4 pb-10 sm:px-6 lg:mt-0 lg:items-center">
          <div className="animate-fade-in w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl shadow-slate-900/5 ring-1 ring-border sm:p-8 lg:bg-transparent lg:p-0 lg:shadow-none lg:ring-0">
            <div className="mb-7">
              <h2 className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">Entre com seu e-mail e senha.</p>
            </div>

            <Suspense fallback={null}>
              <AvisoExpirou />
            </Suspense>

            <form onSubmit={enviar} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="voce@email.com"
                    className="h-11 pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(erro)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="senha">Senha</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="senha"
                    type={verSenha ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-11 pl-10 pr-11"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    aria-invalid={Boolean(erro)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setVerSenha((v) => !v)}
                    aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    title={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {erro && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
                >
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{erro}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={carregando}
                className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-emerald-700 hover:shadow-primary/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 disabled:cursor-wait disabled:opacity-80"
              >
                {carregando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Entrando…
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Acesso fechado — contas são criadas pelo administrador.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
