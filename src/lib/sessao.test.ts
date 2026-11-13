import { describe, it, expect } from 'vitest'
import { loginEmMs, sessaoExpirada } from './sessao'

// Monta um JWT fake (só o payload importa aqui).
const b64url = (o: object) =>
  btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwt = (payload: object) => `x.${b64url(payload)}.y`

const LOGIN = 1_800_000_000 // segundos
const H = 3600_000

describe('sessao', () => {
  it('lê o horário do login do amr (não do iat)', () => {
    const t = jwt({ iat: LOGIN + 5000, amr: [{ method: 'password', timestamp: LOGIN }] })
    expect(loginEmMs(t)).toBe(LOGIN * 1000)
  })

  it('sem amr com timestamp => não sabe (null) e não expira', () => {
    expect(loginEmMs(jwt({ amr: ['password'] }))).toBeNull()
    expect(sessaoExpirada(jwt({}), Date.now())).toBe(false)
    expect(sessaoExpirada('lixo')).toBe(false)
    expect(sessaoExpirada(null)).toBe(false)
  })

  it('expira 12h depois do login', () => {
    const t = jwt({ amr: [{ method: 'password', timestamp: LOGIN }] })
    expect(sessaoExpirada(t, LOGIN * 1000 + 11.9 * H)).toBe(false)
    expect(sessaoExpirada(t, LOGIN * 1000 + 12 * H)).toBe(true)
  })
})
