import { redirect } from 'next/navigation'
import { getAuthContext } from '@/server/auth/context'
import CriptoClient from './CriptoClient'

export default async function CriptoPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  return <CriptoClient />
}
