import { redirect } from 'next/navigation'
import { getAuthContext } from '@/server/auth/context'
import FiiClient from './FiiClient'

export default async function FiiPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  return <FiiClient />
}
