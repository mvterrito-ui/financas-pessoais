'use client'

import { Suspense, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

// Aviso quando o logout automático (12h) trouxe o usuário de volta pra cá.
// useSearchParams exige Suspense numa página estática.
function AvisoExpirou() {
  const params = useSearchParams()
  if (params.get('expirou') !== '1') return null
  return (
    <p className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-700 dark:text-amber-400">
      Sua sessão expirou (12h). Entre de novo. 🔒
    </p>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    try {
      // Só login: o cadastro é fechado (contas são criadas pelo admin).
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) throw error
      router.refresh()
      router.push('/fluxo')
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Marca */}
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
            💰
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Finanças</h1>
            <p className="text-sm text-muted-foreground">Suas finanças pessoais</p>
          </div>
        </div>

        <Suspense fallback={null}>
          <AvisoExpirou />
        </Suspense>
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Entrar 👋</h2>

          <form onSubmit={enviar} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {erro && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {erro}
              </p>
            )}

            <Button type="submit" disabled={carregando} className="w-full">
              {carregando ? 'Aguarde…' : 'Entrar'}
            </Button>
          </form>

        </Card>
      </div>
    </main>
  )
}
