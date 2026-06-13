import { redirect } from 'next/navigation'
import { getAuthContext } from '@/server/auth/context'
import ProjecaoClient from './ProjecaoClient'

export default async function ProjecaoPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  return <ProjecaoClient />
}
