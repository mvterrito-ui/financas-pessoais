// Regras da sessão — funções PURAS (rodam no proxy e no navegador).

/** Depois de quanto tempo do LOGIN a sessão cai, mesmo com uso contínuo. */
export const SESSAO_MAX_HORAS = 12

type AmrEntry = { method?: string; timestamp?: number }

/**
 * Momento do login (ms) a partir do access token do Supabase.
 * O claim `amr` guarda { method, timestamp } da autenticação e NÃO muda
 * quando o token é renovado — diferente do `iat`. Sem amr com timestamp,
 * devolve null (não dá pra saber; não desloga).
 */
export function loginEmMs(accessToken: string | null | undefined): number | null {
  if (!accessToken) return null
  try {
    const payload = accessToken.split('.')[1]
    const json = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=')),
    )
    const amr: unknown[] = Array.isArray(json.amr) ? json.amr : []
    const ts = amr
      .map((a) => (a as AmrEntry)?.timestamp)
      .filter((t): t is number => typeof t === 'number')
    return ts.length ? Math.max(...ts) * 1000 : null
  } catch {
    return null
  }
}

/** Quando a sessão expira (ms), ou null se não der pra saber. */
export function expiraEmMs(accessToken: string | null | undefined, maxHoras = SESSAO_MAX_HORAS) {
  const login = loginEmMs(accessToken)
  return login === null ? null : login + maxHoras * 3600_000
}

export function sessaoExpirada(
  accessToken: string | null | undefined,
  agoraMs = Date.now(),
  maxHoras = SESSAO_MAX_HORAS,
): boolean {
  const expira = expiraEmMs(accessToken, maxHoras)
  return expira !== null && agoraMs >= expira
}
