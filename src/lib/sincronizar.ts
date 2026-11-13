// Sincronização do Patrimônio (foto do mês dos investimentos) feita pelo
// navegador — em SEGUNDO PLANO e no máximo a cada 10 min por aba. O cron
// diário garante o fechamento do mês; isto só deixa o mês atual "fresco".

const CHAVE = 'patrimonio-sync-em'
const INTERVALO_MS = 10 * 60_000

/** Sincroniza se passou o intervalo. Resolve true se sincronizou agora. */
export async function sincronizarPatrimonio(): Promise<boolean> {
  try {
    const ultima = Number(sessionStorage.getItem(CHAVE) || 0)
    if (Date.now() - ultima < INTERVALO_MS) return false
  } catch {
    // sessionStorage indisponível (aba privada etc.): sincroniza mesmo assim.
  }
  const res = await fetch('/api/patrimonio/sincronizar', { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? 'Erro ao sincronizar')
  }
  try {
    sessionStorage.setItem(CHAVE, String(Date.now()))
  } catch {}
  return true
}

/** Força a próxima sincronização (ex.: depois de mexer num investimento). */
export function invalidarSincronizacao() {
  try {
    sessionStorage.removeItem(CHAVE)
  } catch {}
}
