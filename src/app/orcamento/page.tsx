import { redirect } from 'next/navigation'
import { getAuthContext } from '@/server/auth/context'
import OrcamentoClient from './OrcamentoClient'

export default async function OrcamentoPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  return <OrcamentoClient />
}
