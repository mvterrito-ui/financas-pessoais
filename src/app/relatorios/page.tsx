import { redirect } from 'next/navigation'
import { getAuthContext } from '@/server/auth/context'
import RelatoriosClient from './RelatoriosClient'

export default async function RelatoriosPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  return <RelatoriosClient />
}
