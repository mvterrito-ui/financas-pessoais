// Importa o bloco "VALOR APLICADO" (ATIVOS.xlsx) pro módulo Cripto.
// Anos com bloco limpo: 2024, 2025, 2026. Uso: node scripts/importar-cripto.mjs <email>
// Re-rodável: UPSERT por (corretora, ano).
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

function env(chave) {
  const linha = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .find((l) => l.startsWith(chave + '='))
  if (!linha) throw new Error(`Falta ${chave} no .env.local`)
  return linha.slice(chave.length + 1).trim()
}
const supabase = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})

const email = process.argv[2]
const { data: lista } = await supabase.auth.admin.listUsers()
const user = email
  ? lista.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  : lista.users.length === 1
    ? lista.users[0]
    : null
if (!user) throw new Error('Passe o e-mail (há vários usuários ou não encontrei).')
const { data: profile } = await supabase
  .from('profile').select('tenant_id').eq('id', user.id).single()
const tenant_id = profile.tenant_id
console.log(`👤 Importando cripto para: ${user.email}`)

const CORRETORAS = ['BINANCE', 'BYBIT', 'BYBIT II', 'GATE']
const ANOS = ['2024', '2025', '2026']

const buf = readFileSync(new URL('../data/ATIVOS.xlsx', import.meta.url))
const wb = XLSX.read(buf, { type: 'buffer' })

const ehNum = (v) => typeof v === 'number' && Number.isFinite(v)
const registros = []

for (const aba of ANOS) {
  const ws = wb.Sheets[aba]
  if (!ws) continue
  const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  for (const linha of linhas) {
    // acha a célula com o nome de uma corretora (a coluna varia por aba)
    const i = linha.findIndex(
      (c) => typeof c === 'string' && CORRETORAS.includes(c.trim().toUpperCase()),
    )
    if (i < 0) continue
    const aplicado = linha[i + 1]
    const resultado = linha[i + 2]
    if (!ehNum(aplicado) || aplicado <= 0) continue // pula linhas sem aplicado
    registros.push({
      tenant_id,
      exchange: linha[i].trim().replace(/\s+/g, ' '),
      ano: Number(aba),
      aplicado,
      resultado: ehNum(resultado) ? resultado : 0,
    })
  }
}

const { error } = await supabase
  .from('crypto_summary')
  .upsert(registros, { onConflict: 'tenant_id,exchange,ano' })
if (error) throw error

console.log(`✅ ${registros.length} resumos de cripto importados (upsert):`)
for (const r of registros)
  console.log(`   ${r.ano} ${r.exchange}: aplicado $${r.aplicado} · L/P $${r.resultado}`)
