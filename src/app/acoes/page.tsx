import { redirect } from 'next/navigation'
import { getAuthContext } from '@/server/auth/context'
import AcoesClient from './AcoesClient'

export default async function AcoesPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  return <AcoesClient />
}
