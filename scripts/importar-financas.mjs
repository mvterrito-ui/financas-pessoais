// Importa a aba "Renda Mensal" (FINANCAS.xlsx) pros lançamentos.
// Uso:  node scripts/importar-financas.mjs <seu-email-de-login>
//
// - Lê a planilha em data/FINANCAS.xlsx (originais nunca são tocados).
// - Usa a chave service_role (fura o RLS) só aqui, no servidor.
// - Re-rodável: apaga SÓ os lançamentos criados por este script (external_id
//   'planilha:...'). Faturas OFX/CSV importadas pela tela não são tocadas.
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
console.log(`Importando para: ${user.email}  (tenant ${tenant_id})`)

// ---- 3) Lê a planilha -------------------------------------------------
const buf = readFileSync(new URL('../data/FINANCAS.xlsx', import.meta.url))
const wb = XLSX.read(buf, { type: 'buffer' })
const linhas = XLSX.utils.sheet_to_json(wb.Sheets['Renda Mensal'], {
  header: 1,
  defval: null,
})

const MESES = { Jan: 1, Fev: 2, Mar: 3, Abr: 4, Mai: 5, Jun: 6, Jul: 7, Ago: 8, Set: 9, Out: 10, Nov: 11, Dez: 12 }
// coluna (índice) -> origem do gasto na planilha. Se existir uma fatia do
// Orçamento com o mesmo nome, o lançamento entra nela.
const CONTAS = [
  { idx: 10, name: 'Cartão XP' },
  { idx: 11, name: 'Cartão NU' },
  { idx: 12, name: 'Pix' },
  { idx: 13, name: 'MEI' },
  { idx: 14, name: 'Cartão Bybit' },
  { idx: 15, name: 'Faculdade' },
]
const COL_VALOR = 2 // renda do mês
const COL_MES = 1

// ---- 4) Fatias do Orçamento (por nome) e a categoria "Renda" ----------
async function fatiasPorNome() {
  const { data, error } = await supabase
    .from('budget_bucket')
    .select('id, name')
    .eq('tenant_id', tenant_id)
    .eq('ativo', true)
  if (error) throw error
  return new Map((data ?? []).map((f) => [f.name.trim().toLowerCase(), f.id]))
}

// Categoria "Renda" no plano de contas (grupo de receita; cria se faltar).
async function garantirCategoriaRenda() {
  let { data: grupo } = await supabase
    .from('annual_group')
    .select('id')
    .eq('tenant_id', tenant_id)
    .eq('tipo', 'receita')
    .eq('ativo', true)
    .order('ordem')
    .limit(1)
    .maybeSingle()
  if (!grupo) {
    const r = await supabase
      .from('annual_group')
      .insert({ tenant_id, name: 'Receitas', tipo: 'receita', ordem: 0 })
      .select('id')
      .single()
    if (r.error) throw r.error
    grupo = r.data
  }
  const { data: existente } = await supabase
    .from('annual_item')
    .select('id')
    .eq('group_id', grupo.id)
    .eq('name', 'Renda')
    .eq('ativo', true)
    .maybeSingle()
  if (existente) return existente.id
  const { data, error } = await supabase
    .from('annual_item')
    .insert({ tenant_id, group_id: grupo.id, name: 'Renda', ordem: 1 })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

const fatias = await fatiasPorNome()
const categoriaRenda = await garantirCategoriaRenda()

// ---- 5) Limpa import anterior (re-rodável) ----------------------------
const { error: errDel } = await supabase
  .from('transaction')
  .delete()
  .eq('tenant_id', tenant_id)
  .like('external_id', 'planilha:%')
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
      item_id: categoriaRenda, budget_id: null,
      origem: 'import', external_id: `planilha:${data}:renda`,
    })
  }

  for (const c of CONTAS) {
    const v = num(linha[c.idx])
    if (!v) continue
    lancamentos.push({
      tenant_id, tipo: 'saida', valor: v, data,
      descricao: `${c.name} ${nomeMes}/${ANO}`,
      item_id: null, budget_id: fatias.get(c.name.toLowerCase()) ?? null,
      origem: 'import', external_id: `planilha:${data}:${c.name}`,
    })
  }
}

const { error: errIns } = await supabase.from('transaction').insert(lancamentos)
if (errIns) throw errIns

const entradas = lancamentos.filter((l) => l.tipo === 'entrada').length
const saidas = lancamentos.filter((l) => l.tipo === 'saida').length
console.log(`Importados ${lancamentos.length} lançamentos (${entradas} entradas, ${saidas} saídas).`)
