import { redirect } from 'next/navigation'
import { getAuthContext } from '@/server/auth/context'
import PatrimonioClient from './PatrimonioClient'

export default async function PatrimonioPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  return <PatrimonioClient />
}
