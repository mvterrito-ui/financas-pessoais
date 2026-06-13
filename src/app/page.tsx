import { redirect } from 'next/navigation'
import { getAuthContext } from '@/server/auth/context'
import DashboardClient from './DashboardClient'

// Home = visão geral. Sem login -> /login.
export default async function Home() {
  const ctx = await getAuthContext()
  if (!ctx) redirect('/login')
  return <DashboardClient />
}
