'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [modo, setModo] = useState<'login' | 'cadastro'>('login')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    try {
      if (modo === 'cadastro') {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { data: { name: nome } },
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: senha,
        })
        if (error) throw error
      }
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

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">
            {modo === 'login' ? 'Entrar 👋' : 'Criar conta ✨'}
          </h2>

          <form onSubmit={enviar} className="space-y-3">
            {modo === 'cadastro' && (
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>
            )}

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
              {carregando ? 'Aguarde…' : modo === 'login' ? 'Entrar' : 'Cadastrar'}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              setModo(modo === 'login' ? 'cadastro' : 'login')
              setErro(null)
            }}
            className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
          >
            {modo === 'login'
              ? 'Não tem conta? Cadastre-se'
              : 'Já tem conta? Entrar'}
          </button>
        </Card>
      </div>
    </main>
  )
}
