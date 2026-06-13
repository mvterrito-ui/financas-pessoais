import { redirect } from 'next/navigation'
import { getAuthContext } from '@/server/auth/context'
import RendaFixaClient from './RendaFixaClient'

export default async function RendaFixaPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  return <RendaFixaClient />
}
