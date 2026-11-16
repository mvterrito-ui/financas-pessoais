// Cria/atualiza um usuário DEMO ("João da Silva") com dados 100% FICTÍCIOS,
// pra mostrar o app sem expor finanças reais. Isolado por tenant (RLS).
//
// Uso:  npm run seed:demo
//
// - Usa a chave service_role (admin) — cria o usuário mesmo com cadastro
//   bloqueado no painel, e sem enviar e-mail (email_confirm: true).
// - Idempotente: limpa os dados do tenant demo e recria do zero.
import { readFileSync } from 'node:fs'

// TRAVA: o .env.local aponta pro projeto Supabase de PRODUÇÃO, e a senha do demo
// é pública (README). Rodar isso lá abre uma porta de entrada no app.
// Só roda com confirmação explícita: npm run seed:demo -- --sim
if (!process.argv.includes('--sim')) {
  console.error(
    'Atenção: este script cria um usuário de demonstração no projeto do .env.local.\n' +
      '    Use só num projeto Supabase de teste. Pra confirmar: npm run seed:demo -- --sim',
  )
  process.exit(1)
}
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const DEMO_EMAIL = 'joao.demo@gmail.com'
// Senha NUNCA fixa no código (o repositório é público): vem de DEMO_SENHA ou é
// gerada aleatória a cada execução e mostrada no fim.
//   DEMO_SENHA=minhasenha npm run seed:demo -- --sim
const DEMO_SENHA = process.env.DEMO_SENHA || randomBytes(9).toString('base64url')
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
  console.log(`Usuário demo criado: ${DEMO_EMAIL}`)
} else {
  // Já existe: troca a senha pela desta execução (a antiga pode ter vazado).
  ok((await supabase.auth.admin.updateUserById(user.id, { password: DEMO_SENHA })).error, 'updateUser')
  console.log(`Usuário demo já existia: ${DEMO_EMAIL} (senha trocada)`)
}

// o gatilho handle_new_user já criou tenant + profile
const { data: profile, error: errProf } = await supabase
  .from('profile')
  .select('tenant_id')
  .eq('id', user.id)
  .single()
ok(errProf, 'profile')
const tenant_id = profile.tenant_id
console.log(`tenant ${tenant_id}`)

// ---- 2) limpa dados antigos do demo (re-rodável) ---------------------
// (ordem importa por causa das chaves estrangeiras)
for (const t of [
  'transaction', 'recorrencia', 'annual_value', 'annual_item', 'annual_category', 'annual_group',
  'crypto_item', 'crypto_summary', 'fii', 'fixed_income', 'wealth_snapshot', 'budget_bucket', 'account', 'category',
]) {
  const { error } = await supabase.from(t).delete().eq('tenant_id', tenant_id)
  ok(error, `limpar ${t}`)
}

// ---- 3) plano de contas (com metas), fatias do orçamento e recorrências ------------
async function inserir(tabela, linhas, select = 'id, name') {
  const { data, error } = await supabase.from(tabela).insert(linhas).select(select)
  ok(error, `inserir ${tabela}`)
  return data
}

const grupos = await inserir('annual_group', [
  { tenant_id, name: 'Receitas', tipo: 'receita', ordem: 1 },
  { tenant_id, name: 'Despesas fixas', tipo: 'despesa', ordem: 2, meta_pct: 50 },
  { tenant_id, name: 'Despesas variáveis', tipo: 'despesa', ordem: 3, meta_pct: 30 },
  { tenant_id, name: 'Investimentos', tipo: 'investimento', ordem: 4, meta_pct: 10 },
])
const grupo = (n) => grupos.find((g) => g.name === n).id
const itens = await inserir('annual_item', [
  { tenant_id, group_id: grupo('Receitas'), name: 'Salário', ordem: 1 },
  { tenant_id, group_id: grupo('Despesas fixas'), name: 'Aluguel', ordem: 1 },
  { tenant_id, group_id: grupo('Despesas fixas'), name: 'Assinaturas', ordem: 2 },
  { tenant_id, group_id: grupo('Despesas variáveis'), name: 'Mercado', ordem: 1 },
  { tenant_id, group_id: grupo('Despesas variáveis'), name: 'Transporte', ordem: 2 },
  { tenant_id, group_id: grupo('Despesas variáveis'), name: 'Lazer', ordem: 3 },
  { tenant_id, group_id: grupo('Despesas variáveis'), name: 'Eletrônicos', ordem: 4 },
  { tenant_id, group_id: grupo('Investimentos'), name: 'Aporte mensal', ordem: 1 },
])
const cat = (n) => itens.find((i) => i.name === n).id

const fatias = await inserir('budget_bucket', [
  { tenant_id, name: 'Gastos fixos', percentual: 50, ordem: 1 },
  { tenant_id, name: 'Dia a dia', percentual: 30, ordem: 2 },
  { tenant_id, name: 'Investir', percentual: 20, ordem: 3 },
])
const fatia = (n) => (n ? fatias.find((f) => f.name === n).id : null)

const recs = await inserir(
  'recorrencia',
  [
    { tenant_id, tipo: 'entrada', descricao: 'Salário', valor: 6000, item_id: cat('Salário'), budget_id: null, dia: 5, inicio: `${ANO}-01-01` },
    { tenant_id, tipo: 'saida', descricao: 'Aluguel', valor: 1800, item_id: cat('Aluguel'), budget_id: fatia('Gastos fixos'), dia: 10, inicio: `${ANO}-01-01` },
    { tenant_id, tipo: 'saida', descricao: 'Assinaturas (streaming)', valor: 119, item_id: cat('Assinaturas'), budget_id: fatia('Gastos fixos'), dia: 1, inicio: `${ANO}-01-01` },
  ],
  'id, descricao',
)
const rec = (d) => recs.find((r) => r.descricao === d).id

// ---- 4) lançamentos mês a mês ----------------------------------------
const txs = []
const mercadoMes = [950, 1020, 880, 1100, 970, 1030]
const lazerMes = [400, 250, 500, 380, 420, 300]
const dia = (m, d) => `${ANO}-${m}-${d}`
// Lançamento que confirma a recorrência daquele mês.
const confirmado = (m, d, tipo, valor, descricao, item, f) => ({
  tenant_id, tipo, valor, data: dia(m, d), descricao, item_id: cat(item), budget_id: fatia(f),
  recorrencia_id: rec(descricao), competencia: `${ANO}-${m}-01`,
})

MESES.forEach((m, i) => {
  txs.push(confirmado(m, '05', 'entrada', 6000, 'Salário', 'Salário', null))
  txs.push(confirmado(m, '10', 'saida', 1800, 'Aluguel', 'Aluguel', 'Gastos fixos'))
  txs.push(confirmado(m, '01', 'saida', 119, 'Assinaturas (streaming)', 'Assinaturas', 'Gastos fixos'))
  txs.push({ tenant_id, tipo: 'saida', valor: mercadoMes[i], data: dia(m, '15'), descricao: 'Mercado do mês', item_id: cat('Mercado'), budget_id: fatia('Dia a dia') })
  txs.push({ tenant_id, tipo: 'saida', valor: 320, data: dia(m, '08'), descricao: 'Transporte', item_id: cat('Transporte'), budget_id: fatia('Dia a dia') })
  txs.push({ tenant_id, tipo: 'saida', valor: lazerMes[i], data: dia(m, '20'), descricao: 'Lazer', item_id: cat('Lazer'), budget_id: fatia('Dia a dia') })
  txs.push({ tenant_id, tipo: 'saida', valor: 600, data: dia(m, '06'), descricao: 'Aporte no Tesouro', item_id: cat('Aporte mensal'), budget_id: fatia('Investir') })
})

// uma compra parcelada (notebook 12x de 300, a partir de março) -> mostra o recurso
const grupoParcelas = randomUUID()
for (let p = 0; p < 12; p++) {
  const d = new Date(ANO, 2 + p, 15) // março = mês índice 2
  const data = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`
  txs.push({
    tenant_id, tipo: 'saida', valor: 300, data, descricao: 'Notebook Dell',
    item_id: cat('Eletrônicos'), budget_id: fatia('Dia a dia'),
    parcela_grupo: grupoParcelas, parcela_num: p + 1, parcela_total: 12,
  })
}
ok((await supabase.from('transaction').insert(txs)).error, 'inserir transaction')
console.log(`${txs.length} lançamentos`)

// ---- 5) patrimônio: snapshots crescentes nos lugares do gatilho ------
// Conta nova começa vazia (0018): cria os bens manuais do demo se faltarem.
const BENS_DEMO = [
  { name: 'Reserva', moeda: 'BRL' },
  { name: 'Conta corrente', moeda: 'BRL' },
  { name: 'Dólar', moeda: 'USD' },
]
const { data: jaTem, error: errJa } = await supabase
  .from('wealth_place').select('name').eq('tenant_id', tenant_id).is('origem', null)
ok(errJa, 'wealth_place (existentes)')
const faltam = BENS_DEMO.filter((b) => !jaTem.some((p) => p.name === b.name))
if (faltam.length) {
  ok(
    (await supabase.from('wealth_place').insert(faltam.map((b, i) => ({ ...b, tenant_id, ordem: i + 1 })))).error,
    'criar wealth_place',
  )
}
const { data: places, error: errPl } = await supabase
  .from('wealth_place').select('id, name').eq('tenant_id', tenant_id).is('origem', null).eq('ativo', true)
ok(errPl, 'wealth_place')
const baseLugar = { Reserva: 10000, 'Conta corrente': 3000, 'Dólar': 2000 }
const snaps = []
for (const pl of places) {
  const base = baseLugar[pl.name] ?? 1000
  MESES.forEach((m, i) => {
    snaps.push({ tenant_id, place_id: pl.id, mes: `${ANO}-${m}-01`, valor: Math.round(base * Math.pow(1.025, i)) })
  })
}
ok((await supabase.from('wealth_snapshot').insert(snaps)).error, 'inserir wealth_snapshot')
console.log(`${snaps.length} snapshots de patrimônio`)

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
console.log('FIIs, renda fixa e cripto')

console.log('\nDemo pronto.')
console.log(`   Login:  ${DEMO_EMAIL}`)
console.log(`   Senha:  ${DEMO_SENHA}`)
