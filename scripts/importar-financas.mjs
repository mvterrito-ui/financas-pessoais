// Importa a aba "Renda Mensal" (FINANCAS.xlsx) pro Fluxo de Caixa.
// Uso:  node scripts/importar-financas.mjs <seu-email-de-login>
//
// - Lê a planilha em data/FINANCAS.xlsx (originais nunca são tocados).
// - Usa a chave service_role (fura o RLS) só aqui, no servidor.
// - Re-rodável: apaga os lançamentos origem='import' do seu tenant antes.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const ANO = 2026

// ---- 1) Lê credenciais do .env.local ---------------------------------
function env(chave) {
  const linha = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .find((l) => l.startsWith(chave + '='))
  if (!linha) throw new Error(`Falta ${chave} no .env.local`)
  return linha.slice(chave.length + 1).trim()
}
const URL_SB = env('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE = env('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(URL_SB, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ---- 2) Descobre o tenant pelo e-mail ---------------------------------
const email = process.argv[2]
const { data: lista, error: errUsers } = await supabase.auth.admin.listUsers()
if (errUsers) throw errUsers

let user
if (email) {
  user = lista.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) throw new Error(`Usuário ${email} não encontrado.`)
} else if (lista.users.length === 1) {
  user = lista.users[0]
} else {
  throw new Error(
    `Vários usuários. Passe o e-mail. Existentes: ${lista.users.map((u) => u.email).join(', ')}`,
  )
}

const { data: profile, error: errProf } = await supabase
  .from('profile')
  .select('tenant_id')
  .eq('id', user.id)
  .single()
if (errProf || !profile?.tenant_id) throw new Error('Tenant do usuário não encontrado.')
const tenant_id = profile.tenant_id
console.log(`👤 Importando para: ${user.email}  (tenant ${tenant_id})`)

// ---- 3) Lê a planilha -------------------------------------------------
const buf = readFileSync(new URL('../data/FINANCAS.xlsx', import.meta.url))
const wb = XLSX.read(buf, { type: 'buffer' })
const linhas = XLSX.utils.sheet_to_json(wb.Sheets['Renda Mensal'], {
  header: 1,
  defval: null,
})

const MESES = { Jan: 1, Fev: 2, Mar: 3, Abr: 4, Mai: 5, Jun: 6, Jul: 7, Ago: 8, Set: 9, Out: 10, Nov: 11, Dez: 12 }
// coluna (índice) -> conta
const CONTAS = [
  { idx: 10, name: 'Cartão XP', tipo: 'cartao' },
  { idx: 11, name: 'Cartão NU', tipo: 'cartao' },
  { idx: 12, name: 'Pix', tipo: 'conta' },
  { idx: 13, name: 'MEI', tipo: 'conta' },
  { idx: 14, name: 'Cartão Bybit', tipo: 'cartao' },
  { idx: 15, name: 'Faculdade', tipo: 'conta' },
]
const COL_VALOR = 2 // renda do mês
const COL_MES = 1

// ---- 4) Garante contas e a categoria "Renda" --------------------------
async function garantirContas() {
  const { data: existentes } = await supabase
    .from('account')
    .select('id, name')
    .eq('tenant_id', tenant_id)
  const mapa = new Map((existentes ?? []).map((a) => [a.name, a.id]))

  for (const c of CONTAS) {
    if (mapa.has(c.name)) continue
    const { data, error } = await supabase
      .from('account')
      .insert({ tenant_id, name: c.name, tipo: c.tipo, moeda: 'BRL' })
      .select('id')
      .single()
    if (error) throw error
    mapa.set(c.name, data.id)
  }
  return mapa
}

async function garantirCategoriaRenda() {
  const { data: existente } = await supabase
    .from('category')
    .select('id')
    .eq('tenant_id', tenant_id)
    .eq('name', 'Renda')
    .eq('tipo', 'entrada')
    .maybeSingle()
  if (existente) return existente.id
  const { data, error } = await supabase
    .from('category')
    .insert({ tenant_id, name: 'Renda', tipo: 'entrada' })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

const contas = await garantirContas()
const categoriaRenda = await garantirCategoriaRenda()

// ---- 5) Limpa import anterior (re-rodável) ----------------------------
const { error: errDel } = await supabase
  .from('transaction')
  .delete()
  .eq('tenant_id', tenant_id)
  .eq('origem', 'import')
if (errDel) throw errDel

// ---- 6) Monta e insere os lançamentos ---------------------------------
const num = (v) => (typeof v === 'number' && v > 0 ? v : null)
const lancamentos = []

for (const linha of linhas) {
  const mes = MESES[linha?.[COL_MES]]
  if (!mes) continue
  const nomeMes = linha[COL_MES]
  const data = `${ANO}-${String(mes).padStart(2, '0')}-01`

  const renda = num(linha[COL_VALOR])
  if (renda) {
    lancamentos.push({
      tenant_id, tipo: 'entrada', valor: renda, data,
      descricao: `Renda ${nomeMes}/${ANO}`,
      category_id: categoriaRenda, account_id: null,
      recorrente: false, origem: 'import',
    })
  }

  for (const c of CONTAS) {
    const v = num(linha[c.idx])
    if (!v) continue
    lancamentos.push({
      tenant_id, tipo: 'saida', valor: v, data,
      descricao: `${c.name} ${nomeMes}/${ANO}`,
      category_id: null, account_id: contas.get(c.name),
      recorrente: false, origem: 'import',
    })
  }
}

const { error: errIns } = await supabase.from('transaction').insert(lancamentos)
if (errIns) throw errIns

const entradas = lancamentos.filter((l) => l.tipo === 'entrada').length
const saidas = lancamentos.filter((l) => l.tipo === 'saida').length
console.log(`✅ Importados ${lancamentos.length} lançamentos (${entradas} entradas, ${saidas} saídas).`)
