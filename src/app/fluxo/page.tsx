import { redirect } from 'next/navigation'
import { getAuthContext } from '@/server/auth/context'
import FluxoClient from './FluxoClient'

// Server Component: a PRIMEIRA coisa é checar login no servidor.
// Sem sessão -> redireciona pro /login antes de renderizar qualquer coisa.
export default async function FluxoPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  return <FluxoClient />
}
