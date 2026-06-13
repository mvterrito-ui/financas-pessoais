// Cria/atualiza um usuário DEMO ("João da Silva") com dados 100% FICTÍCIOS,
// pra mostrar o app sem expor finanças reais. Isolado por tenant (RLS).
//
// Uso:  npm run seed:demo
//
// - Usa a chave service_role (admin) — cria o usuário mesmo com cadastro
//   bloqueado no painel, e sem enviar e-mail (email_confirm: true).
// - Idempotente: limpa os dados do tenant demo e recria do zero.
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const DEMO_EMAIL = 'joao.demo@gmail.com'
const DEMO_SENHA = 'demo123456'
const DEMO_NOME = 'João da Silva'
const ANO = 2026
const MESES = ['01', '02', '03', '04', '05', '06'] // Jan..Jun/2026

// ---- credenciais do .env.local ---------------------------------------
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

const ok = (error, ctx) => {
  if (error) throw new Error(`${ctx}: ${error.message}`)
}

// ---- 1) cria (ou acha) o usuário demo --------------------------------
const { data: lista, error: errList } = await supabase.auth.admin.listUsers()
ok(errList, 'listUsers')
let user = lista.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL)
if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_SENHA,
    email_confirm: true,
    user_metadata: { name: DEMO_NOME },
  })
  ok(error, 'createUser')
  user = data.user
  console.log(`👤 Usuário demo criado: ${DEMO_EMAIL}`)
} else {
  console.log(`👤 Usuário demo já existe: ${DEMO_EMAIL}`)
}

// o gatilho handle_new_user já criou tenant + baldes + lugares
const { data: profile, error: errProf } = await supabase
  .from('profile')
  .select('tenant_id')
  .eq('id', user.id)
  .single()
ok(errProf, 'profile')
const tenant_id = profile.tenant_id
console.log(`🏠 tenant ${tenant_id}`)

// ---- 2) limpa dados antigos do demo (re-rodável) ---------------------
for (const t of ['transaction', 'crypto_item', 'crypto_summary', 'fii', 'fixed_income', 'wealth_snapshot', 'account', 'category']) {
  const { error } = await supabase.from(t).delete().eq('tenant_id', tenant_id)
  ok(error, `limpar ${t}`)
}

// ---- 3) categorias e contas ------------------------------------------
async function inserir(tabela, linhas, select = 'id, name') {
  const { data, error } = await supabase.from(tabela).insert(linhas).select(select)
  ok(error, `inserir ${tabela}`)
  return data
}

const cats = await inserir('category', [
  { tenant_id, name: 'Salário', tipo: 'entrada' },
  { tenant_id, name: 'Mercado', tipo: 'saida' },
  { tenant_id, name: 'Aluguel', tipo: 'saida' },
  { tenant_id, name: 'Transporte', tipo: 'saida' },
  { tenant_id, name: 'Lazer', tipo: 'saida' },
  { tenant_id, name: 'Assinaturas', tipo: 'saida' },
])
const cat = (n) => cats.find((c) => c.name === n).id

const contas = await inserir('account', [
  { tenant_id, name: 'Nubank', tipo: 'cartao', moeda: 'BRL' },
  { tenant_id, name: 'Itaú', tipo: 'conta', moeda: 'BRL' },
  { tenant_id, name: 'Pix', tipo: 'conta', moeda: 'BRL' },
])
const conta = (n) => contas.find((a) => a.name === n).id

// ---- 4) lançamentos mês a mês ----------------------------------------
const txs = []
const mercadoMes = [950, 1020, 880, 1100, 970, 1030]
const lazerMes = [400, 250, 500, 380, 420, 300]
const dia = (m, d) => `${ANO}-${m}-${d}`

MESES.forEach((m, i) => {
  txs.push({ tenant_id, tipo: 'entrada', valor: 6000, data: dia(m, '05'), descricao: 'Salário', category_id: cat('Salário'), account_id: conta('Itaú'), recorrente: true })
  txs.push({ tenant_id, tipo: 'saida', valor: 1800, data: dia(m, '10'), descricao: 'Aluguel', category_id: cat('Aluguel'), account_id: conta('Itaú'), recorrente: true })
  txs.push({ tenant_id, tipo: 'saida', valor: mercadoMes[i], data: dia(m, '15'), descricao: 'Mercado do mês', category_id: cat('Mercado'), account_id: conta('Nubank'), recorrente: false })
  txs.push({ tenant_id, tipo: 'saida', valor: 320, data: dia(m, '08'), descricao: 'Transporte', category_id: cat('Transporte'), account_id: conta('Nubank'), recorrente: false })
  txs.push({ tenant_id, tipo: 'saida', valor: lazerMes[i], data: dia(m, '20'), descricao: 'Lazer', category_id: cat('Lazer'), account_id: conta('Nubank'), recorrente: false })
  txs.push({ tenant_id, tipo: 'saida', valor: 119, data: dia(m, '01'), descricao: 'Assinaturas (streaming)', category_id: cat('Assinaturas'), account_id: conta('Nubank'), recorrente: true })
})

// uma compra parcelada (notebook 12x de 300, a partir de março) -> mostra o recurso
const grupo = randomUUID()
for (let p = 0; p < 12; p++) {
  const d = new Date(ANO, 2 + p, 15) // março = mês índice 2
  const data = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`
  txs.push({
    tenant_id, tipo: 'saida', valor: 300, data, descricao: 'Notebook Dell',
    category_id: null, account_id: conta('Nubank'), recorrente: false,
    parcela_grupo: grupo, parcela_num: p + 1, parcela_total: 12,
  })
}
ok((await supabase.from('transaction').insert(txs)).error, 'inserir transaction')
console.log(`💸 ${txs.length} lançamentos`)

// ---- 5) patrimônio: snapshots crescentes nos lugares do gatilho ------
const { data: places, error: errPl } = await supabase
  .from('wealth_place').select('id, name').eq('tenant_id', tenant_id)
ok(errPl, 'wealth_place')
const baseLugar = { XP: 15000, BTC: 8000, Cripto: 1200, USD: 2000, Revolut: 800, Buddy: 500, BB: 3000, Reserva: 10000 }
const snaps = []
for (const pl of places) {
  const base = baseLugar[pl.name] ?? 1000
  MESES.forEach((m, i) => {
    snaps.push({ tenant_id, place_id: pl.id, mes: `${ANO}-${m}-01`, valor: Math.round(base * Math.pow(1.025, i)) })
  })
}
ok((await supabase.from('wealth_snapshot').insert(snaps)).error, 'inserir wealth_snapshot')
console.log(`📈 ${snaps.length} snapshots de patrimônio`)

// ---- 6) FIIs, Renda Fixa e Cripto ------------------------------------
ok((await supabase.from('fii').insert([
  { tenant_id, ticker: 'MXRF11', quantidade: 200, preco_medio: 10.2 },
  { tenant_id, ticker: 'BTLG11', quantidade: 15, preco_medio: 98.5 },
  { tenant_id, ticker: 'KNCR11', quantidade: 30, preco_medio: 104.0 },
])).error, 'inserir fii')

ok((await supabase.from('fixed_income').insert([
  { tenant_id, nome: 'Tesouro Selic 2029', instituicao: 'XP', tipo: 'Tesouro', valor_aplicado: 10000, valor_atual: 11200, vencimento: '2029-03-01' },
  { tenant_id, nome: 'CDB 110% CDI', instituicao: 'Banco Inter', tipo: 'CDB', valor_aplicado: 5000, valor_atual: 5380, vencimento: '2027-06-01' },
])).error, 'inserir fixed_income')

const [resumo] = await inserir('crypto_summary',
  [{ tenant_id, exchange: 'BINANCE', ano: ANO, aplicado: 5000, resultado: 1200 }], 'id')
ok((await supabase.from('crypto_item').insert([
  { tenant_id, summary_id: resumo.id, label: 'BTC', valor: 4200, ordem: 1 },
  { tenant_id, summary_id: resumo.id, label: 'ETH', valor: 1500, ordem: 2 },
  { tenant_id, summary_id: resumo.id, label: 'Outros', valor: 500, ordem: 3 },
])).error, 'inserir crypto_item')
console.log('🏢 FIIs · 🏦 Renda Fixa · 🪙 Cripto')

console.log('\n✅ Demo pronto!')
console.log(`   Login:  ${DEMO_EMAIL}`)
console.log(`   Senha:  ${DEMO_SENHA}`)
