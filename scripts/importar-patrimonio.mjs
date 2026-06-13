// Importa a aba "2026" (CARTEIRA.xlsx) pro módulo Patrimônio.
// Uso:  node scripts/importar-patrimonio.mjs <seu-email>
//
// Re-rodável: faz UPSERT por (lugar, mês), então rodar de novo só atualiza.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const ANO = 2026

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

// tenant pelo e-mail
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
console.log(`👤 Importando patrimônio para: ${user.email}`)

// mapa nome do lugar -> id
const { data: places } = await supabase
  .from('wealth_place').select('id, name').eq('tenant_id', tenant_id)
const idDoLugar = new Map(places.map((p) => [p.name, p.id]))

// coluna (índice) -> nome do lugar (igual aos semeados)
const COLS = [
  { idx: 2, place: 'XP' },
  { idx: 4, place: 'USD' },
  { idx: 5, place: 'Buddy' },
  { idx: 6, place: 'BTC' },
  { idx: 7, place: 'BB' },
  { idx: 8, place: 'Revolut' },
  { idx: 9, place: 'Cripto' },
  { idx: 11, place: 'Reserva' },
]
const MESES = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 }

const buf = readFileSync(new URL('../data/CARTEIRA.xlsx', import.meta.url))
const wb = XLSX.read(buf, { type: 'buffer' })
const linhas = XLSX.utils.sheet_to_json(wb.Sheets['2026'], { header: 1, defval: null })

const num = (v) => (typeof v === 'number' && v > 0 ? v : null)
const fotos = []
for (const linha of linhas) {
  const mes = MESES[String(linha?.[1]).toUpperCase()]
  if (!mes) continue
  const data = `${ANO}-${String(mes).padStart(2, '0')}-01`
  for (const c of COLS) {
    const v = num(linha[c.idx])
    const place_id = idDoLugar.get(c.place)
    if (!v || !place_id) continue
    fotos.push({ tenant_id, place_id, mes: data, valor: v })
  }
}

const { error } = await supabase
  .from('wealth_snapshot')
  .upsert(fotos, { onConflict: 'place_id,mes' })
if (error) throw error

console.log(`✅ ${fotos.length} fotos de patrimônio importadas (upsert).`)
