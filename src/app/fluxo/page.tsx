import FluxoClient from './FluxoClient'

// Página "casca" (estática): quem não está logado é mandado pro /login pelo
// proxy.ts; os DADOS são protegidos nas rotas /api (withAuth + RLS).
export default function FluxoPage() {
  return <FluxoClient />
}
