// Tema claro/escuro. Preferência salva no aparelho: 'claro' | 'escuro' | 'sistema'.
export type PreferenciaTema = 'claro' | 'escuro' | 'sistema'
export const CHAVE_TEMA = 'tema'

/** Roda no <head> antes da pintura (string estática — sem dado do usuário). */
export const SCRIPT_TEMA = `(function(){try{var p=localStorage.getItem('${CHAVE_TEMA}')||'sistema';var e=p==='escuro'||(p==='sistema'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',e?'dark':'light')}catch(_){}})()`

export function lerPreferencia(): PreferenciaTema {
  try {
    const p = localStorage.getItem(CHAVE_TEMA)
    return p === 'claro' || p === 'escuro' ? p : 'sistema'
  } catch {
    return 'sistema'
  }
}

export function aplicarTema(p: PreferenciaTema) {
  const escuro =
    p === 'escuro' || (p === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-theme', escuro ? 'dark' : 'light')
}

export function salvarPreferencia(p: PreferenciaTema) {
  try {
    if (p === 'sistema') localStorage.removeItem(CHAVE_TEMA)
    else localStorage.setItem(CHAVE_TEMA, p)
  } catch {
    // sem localStorage (aba privada etc.): vale só nesta visita
  }
  aplicarTema(p)
}
