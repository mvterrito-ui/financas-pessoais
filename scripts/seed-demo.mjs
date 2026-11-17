// Cria/atualiza um usuário DEMO ("João da Silva") com dados 100% FICTÍCIOS,
// pra mostrar o app sem expor finanças reais. Isolado por tenant (RLS).
//
// Uso:  npm run seed:demo -- --sim
//       npm run seed:demo -- --sim --manter-senha   (usuário já existe: não troca a senha)
//
// - Usa a chave service_role (admin): cria o usuário mesmo com cadastro
//   bloqueado no painel, e sem enviar e-mail (email_confirm: true).
// - Idempotente: apaga os dados do tenant demo e recria do zero.
// - Cobre todas as telas e situações: janeiro do ano passado até hoje, com
//   recorrências ativas, reajustadas, pausadas, puladas, finalizadas e futuras;
//   previsões a confirmar no mês atual; várias compras na mesma categoria e
//   mês; compra parcelada; lançamentos em dólar, sem categoria e sem fatia;
//   planejado acima e abaixo do realizado; metas estouradas; mês com saldo
//   negativo; subgrupos e categoria oculta; patrimônio com bem oculto e bem
//   em dólar; ações, FIIs, renda fixa, cripto e consórcios em vários status.
import { readFileSync } from 'node:fs'

// TRAVA: o .env.local aponta pro projeto Supabase de PRODUÇÃO. Só roda com
// confirmação explícita: npm run seed:demo -- --sim
if (!process.argv.includes('--sim')) {
  console.error(
    'Atenção: este script cria um usuário de demonstração no projeto do .env.local.\n' +
      '    Pra confirmar: npm run seed:demo -- --sim',
  )
  process.exit(1)
}
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const DEMO_EMAIL = 'joao.demo@gmail.com'
// Senha NUNCA fixa no código (o repositório é público): vem de DEMO_SENHA ou é
// gerada aleatória a cada execução e mostrada no fim.
const DEMO_SENHA = process.env.DEMO_SENHA || randomBytes(9).toString('base64url')
const MANTER_SENHA = process.argv.includes('--manter-senha') && !process.env.DEMO_SENHA
const DEMO_NOME = 'João da Silva'

// ---- datas (horário de Brasília) ---------------------------------------
const HOJE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date()) // AAAA-MM-DD
const A1 = Number(HOJE.slice(0, 4)) // ano atual
const A0 = A1 - 1 // ano anterior
const MES_ATUAL = HOJE.slice(0, 7)
const ym = (ano, mes) => `${ano}-${String(mes).padStart(2, '0')}`
const somaMes = (m, n) => {
  const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1))
  return ym(d.getUTCFullYear(), d.getUTCMonth() + 1)
}
const ultimoDia = (m) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate()
const dataEm = (m, dia) => `${m}-${String(Math.min(dia, ultimoDia(m))).padStart(2, '0')}`
// Todos os meses de janeiro do ano anterior até o mês atual.
const MESES = []
for (let m = ym(A0, 1); m <= MES_ATUAL; m = somaMes(m, 1)) MESES.push(m)

// Números "aleatórios" sempre iguais a cada execução.
let semente = 20250101
const rnd = () => {
  semente = (semente + 0x6d2b79f5) | 0
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const entre = (min, max) => Math.round((min + rnd() * (max - min)) * 100) / 100

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
async function inserir(tabela, linhas, select = 'id, name') {
  // defaultToNull: false -> campo ausente numa linha usa o default do banco (não null).
  const { data, error } = await supabase.from(tabela).insert(linhas, { defaultToNull: false }).select(select)
  ok(error, `inserir ${tabela}`)
  return data
}
async function inserirEmLotes(tabela, linhas) {
  for (let i = 0; i < linhas.length; i += 500) ok((await supabase.from(tabela).insert(linhas.slice(i, i + 500), { defaultToNull: false })).error, `inserir ${tabela}`)
}

// ---- 1) cria (ou acha) o usuário demo --------------------------------
const { data: lista, error: errList } = await supabase.auth.admin.listUsers()
ok(errList, 'listUsers')
let user = lista.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL)
let senhaMostrada = DEMO_SENHA
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
} else if (MANTER_SENHA) {
  senhaMostrada = '(mantida a atual)'
  console.log(`Usuário demo já existia: ${DEMO_EMAIL} (senha mantida)`)
} else {
  // Já existe: troca a senha pela desta execução (a antiga pode ter vazado).
  ok((await supabase.auth.admin.updateUserById(user.id, { password: DEMO_SENHA })).error, 'updateUser')
  console.log(`Usuário demo já existia: ${DEMO_EMAIL} (senha trocada)`)
}

// o gatilho handle_new_user já criou tenant + profile
const { data: profile, error: errProf } = await supabase.from('profile').select('tenant_id').eq('id', user.id).single()
ok(errProf, 'profile')
const tenant_id = profile.tenant_id
ok((await supabase.from('profile').update({ name: DEMO_NOME }).eq('id', user.id)).error, 'nome do perfil')
console.log(`tenant ${tenant_id}  ·  dados de ${MESES[0]} a ${MES_ATUAL}`)

// ---- 2) limpa dados antigos do demo (ordem importa por causa das FKs) ----
for (const t of [
  'transaction', 'recorrencia', 'annual_value', 'annual_item', 'annual_category', 'annual_group',
  'crypto_item', 'crypto_summary', 'fii', 'acao', 'fixed_income', 'consorcio',
  'wealth_snapshot', 'wealth_place', 'budget_bucket', 'account', 'category',
]) {
  ok((await supabase.from(t).delete().eq('tenant_id', tenant_id)).error, `limpar ${t}`)
}

// ---- 3) plano de contas: grupos, subgrupos e categorias -----------------
const grupos = await inserir('annual_group', [
  { tenant_id, name: 'Receitas', tipo: 'receita', ordem: 1 },
  { tenant_id, name: 'Despesas fixas', tipo: 'despesa', ordem: 2, meta_pct: 50, descricao: 'Todo mês, valor quase igual' },
  { tenant_id, name: 'Despesas variáveis', tipo: 'despesa', ordem: 3, meta_pct: 30 },
  { tenant_id, name: 'Investimentos', tipo: 'investimento', ordem: 4, meta_pct: 10 },
])
const grupo = (n) => grupos.find((g) => g.name === n).id
const subs = await inserir('annual_category', [
  { tenant_id, group_id: grupo('Despesas variáveis'), name: 'Casa', ordem: 1 },
  { tenant_id, group_id: grupo('Despesas variáveis'), name: 'Transporte', ordem: 2 },
  { tenant_id, group_id: grupo('Despesas variáveis'), name: 'Lazer', ordem: 3 },
])
const sub = (n) => subs.find((s) => s.name === n).id
const itens = await inserir('annual_item', [
  { tenant_id, group_id: grupo('Receitas'), name: 'Salário', ordem: 1 },
  { tenant_id, group_id: grupo('Receitas'), name: 'Freelas', ordem: 2 },
  { tenant_id, group_id: grupo('Receitas'), name: '13º e bônus', ordem: 3 },
  { tenant_id, group_id: grupo('Despesas fixas'), name: 'Aluguel', ordem: 1 },
  { tenant_id, group_id: grupo('Despesas fixas'), name: 'Condomínio', ordem: 2 },
  { tenant_id, group_id: grupo('Despesas fixas'), name: 'Internet', ordem: 3 },
  { tenant_id, group_id: grupo('Despesas fixas'), name: 'Assinaturas', ordem: 4 },
  { tenant_id, group_id: grupo('Despesas fixas'), name: 'Plano de saúde', ordem: 5 },
  { tenant_id, group_id: grupo('Despesas fixas'), name: 'Consórcio', ordem: 6 },
  // Parou de usar no fim do ano passado: oculta (some dos anos sem valor).
  { tenant_id, group_id: grupo('Despesas fixas'), name: 'Academia', ordem: 7, oculto: true },
  { tenant_id, group_id: grupo('Despesas variáveis'), category_id: sub('Casa'), name: 'Mercado', ordem: 1 },
  { tenant_id, group_id: grupo('Despesas variáveis'), category_id: sub('Casa'), name: 'Farmácia', ordem: 2 },
  { tenant_id, group_id: grupo('Despesas variáveis'), category_id: sub('Transporte'), name: 'Combustível', ordem: 3 },
  { tenant_id, group_id: grupo('Despesas variáveis'), category_id: sub('Transporte'), name: 'Uber', ordem: 4 },
  { tenant_id, group_id: grupo('Despesas variáveis'), category_id: sub('Lazer'), name: 'Restaurantes', ordem: 5 },
  { tenant_id, group_id: grupo('Despesas variáveis'), category_id: sub('Lazer'), name: 'Viagens', ordem: 6 },
  { tenant_id, group_id: grupo('Despesas variáveis'), name: 'Educação', ordem: 7 },
  { tenant_id, group_id: grupo('Despesas variáveis'), name: 'Eletrônicos', ordem: 8 },
  { tenant_id, group_id: grupo('Investimentos'), name: 'Aporte mensal', ordem: 1 },
])
const cat = (n) => itens.find((i) => i.name === n).id

// ---- 4) fatias do orçamento --------------------------------------------
const fatias = await inserir('budget_bucket', [
  { tenant_id, name: 'Gastos fixos', percentual: 50, ordem: 1 },
  { tenant_id, name: 'Dia a dia', percentual: 25, ordem: 2 },
  { tenant_id, name: 'Investir', percentual: 15, ordem: 3 },
  { tenant_id, name: 'Lazer', percentual: 10, ordem: 4 },
])
const fatia = (n) => (n ? fatias.find((f) => f.name === n).id : null)

// ---- 5) recorrências (todas as situações) -------------------------------
const REC = [
  // ativa com reajuste em março
  { descricao: 'Salário', tipo: 'entrada', valor: 11000, dia: 5, item: 'Salário', inicio: ym(A0, 1), reajustes: [[ym(A1, 3), 12000]] },
  // ativa com reajuste em janeiro
  { descricao: 'Aluguel', tipo: 'saida', valor: 1800, dia: 10, item: 'Aluguel', fatia: 'Gastos fixos', inicio: ym(A0, 1), reajustes: [[ym(A1, 1), 1890]] },
  { descricao: 'Condomínio', tipo: 'saida', valor: 520, dia: 10, item: 'Condomínio', fatia: 'Gastos fixos', inicio: ym(A0, 1) },
  // um mês pulado (agosto)
  { descricao: 'Internet', tipo: 'saida', valor: 119.9, dia: 15, item: 'Internet', fatia: 'Gastos fixos', inicio: ym(A0, 1), pulos: [ym(A1, 8)] },
  // em dólar
  { descricao: 'Streaming', tipo: 'saida', valor: 15.99, moeda: 'USD', dia: 20, item: 'Assinaturas', fatia: 'Gastos fixos', inicio: ym(A0, 1) },
  { descricao: 'Plano de saúde', tipo: 'saida', valor: 480, dia: 1, item: 'Plano de saúde', fatia: 'Gastos fixos', inicio: ym(A0, 1), reajustes: [[ym(A1, 6), 535]] },
  { descricao: 'Consórcio apartamento', tipo: 'saida', valor: 1650, dia: 18, item: 'Consórcio', fatia: 'Gastos fixos', inicio: ym(A0, 1), reajustes: [[ym(A1, 1), 1720]] },
  // finalizada no fim do ano passado
  { descricao: 'Academia', tipo: 'saida', valor: 129, dia: 5, item: 'Academia', fatia: 'Dia a dia', inicio: ym(A0, 1), fim: ym(A0, 12) },
  // pausada desde setembro, sem data pra voltar
  { descricao: 'Curso de inglês', tipo: 'saida', valor: 350, dia: 12, item: 'Educação', fatia: 'Dia a dia', inicio: ym(A1, 2), pausa: [ym(A1, 9), null] },
  // começa só no ano que vem
  { descricao: 'Seguro do carro', tipo: 'saida', valor: 210, dia: 25, item: null, fatia: 'Gastos fixos', inicio: ym(A1 + 1, 1) },
  { descricao: 'Aporte mensal', tipo: 'saida', valor: 1300, dia: 6, item: 'Aporte mensal', fatia: 'Investir', inicio: ym(A0, 1) },
]
// No mês atual só estes já foram confirmados; os outros aparecem "a confirmar".
const CONFIRMADAS_NO_MES = ['Salário', 'Aluguel', 'Aporte mensal']

const recs = await inserir(
  'recorrencia',
  REC.map((r) => ({
    tenant_id, tipo: r.tipo, descricao: r.descricao, valor: r.valor, moeda: r.moeda ?? 'BRL',
    item_id: r.item ? cat(r.item) : null, budget_id: fatia(r.fatia), dia: r.dia,
    inicio: `${r.inicio}-01`, fim: r.fim ? `${r.fim}-01` : null,
  })),
  'id, descricao',
)
const recId = (d) => recs.find((r) => r.descricao === d).id
const ajustes = REC.flatMap((r) => (r.reajustes ?? []).map(([m, v]) => ({ tenant_id, recorrencia_id: recId(r.descricao), a_partir: `${m}-01`, valor: v })))
if (ajustes.length) await inserirEmLotes('recorrencia_valor', ajustes)
const pausas = REC.flatMap((r) => [
  ...(r.pulos ?? []).map((m) => ({ tenant_id, recorrencia_id: recId(r.descricao), de: `${m}-01`, ate: `${m}-01` })),
  ...(r.pausa ? [{ tenant_id, recorrencia_id: recId(r.descricao), de: `${r.pausa[0]}-01`, ate: r.pausa[1] ? `${r.pausa[1]}-01` : null }] : []),
])
if (pausas.length) await inserirEmLotes('recorrencia_pausa', pausas)

// ---- 6) lançamentos ----------------------------------------------------
const txs = []
const lanc = (data, tipo, valor, descricao, item, f, extra = {}) => {
  if (data > HOJE && !extra.parcela_grupo) return
  txs.push({ tenant_id, tipo, valor, data, descricao, item_id: item ? cat(item) : null, budget_id: tipo === 'saida' ? fatia(f) : null, ...extra })
}

// Recorrências confirmadas mês a mês.
for (const r of REC) {
  for (const m of MESES) {
    if (m < r.inicio || (r.fim && m > r.fim)) continue
    if ((r.pulos ?? []).includes(m)) continue
    if (r.pausa && m >= r.pausa[0] && (!r.pausa[1] || m <= r.pausa[1])) continue
    if (m === MES_ATUAL && !CONFIRMADAS_NO_MES.includes(r.descricao)) continue
    const valor = [...(r.reajustes ?? [])].reverse().find(([de]) => m >= de)?.[1] ?? r.valor
    lanc(dataEm(m, r.dia), r.tipo, valor, r.descricao, r.item, r.fatia, {
      moeda: r.moeda ?? 'BRL', recorrencia_id: recId(r.descricao), competencia: `${m}-01`,
    })
  }
}

// Gastos do dia a dia: várias compras por mês na mesma categoria.
for (const m of MESES) {
  for (const d of [3, 11, 19, 27]) lanc(dataEm(m, d), 'saida', entre(170, 340), 'Mercado', 'Mercado', 'Dia a dia')
  if (rnd() < 0.7) lanc(dataEm(m, 14), 'saida', entre(45, 160), 'Farmácia', 'Farmácia', null) // sem fatia
  for (const d of [8, 22]) lanc(dataEm(m, d), 'saida', entre(170, 260), 'Posto', 'Combustível', 'Dia a dia')
  lanc(dataEm(m, 16), 'saida', entre(50, 150), 'Uber', 'Uber', 'Dia a dia')
  for (const d of [9, 24]) lanc(dataEm(m, d), 'saida', entre(80, 230), 'Restaurante', 'Restaurantes', 'Lazer')
}

// Receitas extras.
lanc(`${A0}-04-20`, 'entrada', 1200, 'Freela site', 'Freelas', null)
lanc(`${A0}-09-12`, 'entrada', 2000, 'Freela consultoria', 'Freelas', null)
lanc(`${A1}-02-18`, 'entrada', 1500, 'Freela site', 'Freelas', null)
lanc(`${A1}-06-25`, 'entrada', 2500, 'Freela consultoria', 'Freelas', null)
lanc(`${A0}-11-28`, 'entrada', 5500, '13º salário (1ª parcela)', '13º e bônus', null)
lanc(`${A0}-12-18`, 'entrada', 5500, '13º salário (2ª parcela)', '13º e bônus', null)
lanc(`${A1}-03-30`, 'entrada', 4000, 'Bônus anual', '13º e bônus', null)

// Viagens: julho deste ano estoura o plano e deixa o saldo do mês negativo.
lanc(`${A0}-07-08`, 'saida', 2400, 'Viagem Serra Gaúcha', 'Viagens', 'Lazer')
lanc(`${A1}-01-12`, 'saida', 3800, 'Viagem praia', 'Viagens', 'Lazer')
lanc(`${A1}-07-05`, 'saida', 9800, 'Viagem Europa', 'Viagens', 'Lazer')
lanc(`${A1}-07-15`, 'saida', 320, 'Seguro viagem', 'Viagens', 'Lazer', { moeda: 'USD' })

// Em dólar e aporte extra.
lanc(`${A1}-04-09`, 'saida', 49, 'Curso online', 'Educação', 'Dia a dia', { moeda: 'USD' })
lanc(`${A0}-12-20`, 'saida', 3000, 'Aporte extra (13º)', 'Aporte mensal', 'Investir')

// Compra parcelada: notebook em 10x a partir de março (parcelas futuras incluídas).
const grupoParcelas = randomUUID()
for (let p = 0; p < 10; p++) {
  lanc(dataEm(somaMes(ym(A1, 3), p), 15), 'saida', 450, 'Notebook', 'Eletrônicos', 'Dia a dia', {
    parcela_grupo: grupoParcelas, parcela_num: p + 1, parcela_total: 10,
  })
}

// Sem categoria (aparece o aviso no Controle Anual e em Relatórios).
lanc(dataEm(somaMes(MES_ATUAL, -1), 21), 'saida', 150, 'Pix para amigo', null, null)
lanc(dataEm(MES_ATUAL, 2), 'saida', 24.9, 'Tarifa bancária', null, null)

await inserirEmLotes('transaction', txs)
console.log(`${txs.length} lançamentos · ${recs.length} recorrências`)

// ---- 7) planejado digitado no Controle Anual ----------------------------
const plano = []
const planejar = (item, meses, valor) => meses.forEach((m) => plano.push({ tenant_id, item_id: cat(item), mes: `${m}-01`, valor }))
const doAno = (a) => Array.from({ length: 12 }, (_, i) => ym(a, i + 1))
planejar('Mercado', doAno(A0), 900)
planejar('Mercado', doAno(A1), 1000)
planejar('Combustível', doAno(A1), 400)
planejar('Restaurantes', doAno(A1), 300)
planejar('Uber', doAno(A1), 100)
planejar('Salário', doAno(A1).slice(0, 2), 11000)
planejar('Salário', doAno(A1).slice(2), 12000)
planejar('Aluguel', doAno(A1), 1890)
planejar('Aporte mensal', doAno(A1), 1300)
planejar('Viagens', [ym(A1, 1)], 3000)
planejar('Viagens', [ym(A1, 7)], 6000)
await inserirEmLotes('annual_value', plano)
console.log(`${plano.length} valores planejados`)

// ---- 8) investimentos ---------------------------------------------------
ok((await supabase.from('acao').insert([
  { tenant_id, ticker: 'PETR4', quantidade: 100, preco_medio: 32.5 },
  { tenant_id, ticker: 'ITUB4', quantidade: 200, preco_medio: 27.8 },
  { tenant_id, ticker: 'WEGE3', quantidade: 60, preco_medio: 39.0 },
  { tenant_id, ticker: 'VALE3', quantidade: 50, preco_medio: 62.0 },
])).error, 'inserir acao')
ok((await supabase.from('fii').insert([
  { tenant_id, ticker: 'MXRF11', quantidade: 300, preco_medio: 10.1 },
  { tenant_id, ticker: 'BTLG11', quantidade: 20, preco_medio: 98.5 },
  { tenant_id, ticker: 'KNCR11', quantidade: 30, preco_medio: 101.0 },
  { tenant_id, ticker: 'HGLG11', quantidade: 10, preco_medio: 158.0 },
])).error, 'inserir fii')
ok((await supabase.from('fixed_income').insert([
  { tenant_id, nome: 'Tesouro Selic 2029', instituicao: 'XP', tipo: 'Tesouro', valor_aplicado: 10000, valor_atual: 11850, vencimento: '2029-03-01' },
  { tenant_id, nome: 'CDB 110% CDI', instituicao: 'Banco Inter', tipo: 'CDB', valor_aplicado: 5000, valor_atual: 5620, vencimento: '2027-06-01' },
  { tenant_id, nome: 'LCI 95% CDI', instituicao: 'Nubank', tipo: 'LCI', valor_aplicado: 3000, valor_atual: 3180, vencimento: `${A1}-12-15` },
  { tenant_id, nome: 'Tesouro IPCA+ 2035', instituicao: 'XP', tipo: 'Tesouro', valor_aplicado: 4000, valor_atual: 4310, vencimento: '2035-05-15' },
])).error, 'inserir fixed_income')
// Cripto em dólar: um resumo por corretora e ano (vale o ano mais recente).
const resumos = await inserir('crypto_summary', [
  { tenant_id, exchange: 'BINANCE', ano: A0, aplicado: 2000, resultado: 300 },
  { tenant_id, exchange: 'BINANCE', ano: A1, aplicado: 3000, resultado: 650 },
  { tenant_id, exchange: 'BYBIT', ano: A1, aplicado: 800, resultado: -120 },
], 'id, exchange, ano')
const resumo = (e, a) => resumos.find((r) => r.exchange === e && r.ano === a).id
ok((await supabase.from('crypto_item').insert([
  { tenant_id, summary_id: resumo('BINANCE', A0), label: 'BTC', valor: 1700, ordem: 1 },
  { tenant_id, summary_id: resumo('BINANCE', A0), label: 'ETH', valor: 600, ordem: 2 },
  { tenant_id, summary_id: resumo('BINANCE', A1), label: 'BTC', valor: 2400, ordem: 1 },
  { tenant_id, summary_id: resumo('BINANCE', A1), label: 'ETH', valor: 900, ordem: 2 },
  { tenant_id, summary_id: resumo('BINANCE', A1), label: 'SOL', valor: 350, ordem: 3 },
  { tenant_id, summary_id: resumo('BYBIT', A1), label: 'Outros', valor: 680, ordem: 1 },
])).error, 'inserir crypto_item')
// Consórcios: em andamento (com reajuste), contemplado e encerrado.
const consorcios = await inserir('consorcio', [
  { tenant_id, nome: 'Apartamento', administradora: 'Porto Seguro', tipo: 'imovel', valor_carta: 300000, prazo_meses: 200, parcelas_pagas: MESES.length, valor_parcela: 1650, status: 'ativo' },
  { tenant_id, nome: 'Carro', administradora: 'Embracon', tipo: 'veiculo', valor_carta: 80000, prazo_meses: 60, parcelas_pagas: 38, valor_parcela: 1420, status: 'contemplado' },
  { tenant_id, nome: 'Moto', administradora: 'Honda', tipo: 'veiculo', valor_carta: 18000, prazo_meses: 36, parcelas_pagas: 36, valor_parcela: 560, status: 'encerrado' },
], 'id, nome')
ok((await supabase.from('consorcio_reajuste').insert([
  { tenant_id, consorcio_id: consorcios.find((c) => c.nome === 'Apartamento').id, a_partir_parcela: 13, valor_parcela: 1720 },
])).error, 'inserir consorcio_reajuste')
console.log('Ações, FIIs, renda fixa, cripto e consórcios')

// ---- 9) patrimônio: bens manuais e automáticos, com histórico -----------
// Automáticos: os mesmos 5 que o app cria (ordem negativa = antes dos manuais).
const ORIGENS = [
  { origem: 'acao', name: 'Ações', moeda: 'BRL' },
  { origem: 'fii', name: 'FIIs', moeda: 'BRL' },
  { origem: 'renda_fixa', name: 'Renda Fixa', moeda: 'BRL' },
  { origem: 'cripto', name: 'Cripto', moeda: 'USD' },
  { origem: 'consorcio', name: 'Consórcios', moeda: 'BRL' },
]
const automaticos = await inserir(
  'wealth_place',
  ORIGENS.map((o, i) => ({ tenant_id, ...o, ordem: i - ORIGENS.length })),
  'id, origem',
)
const manuais = await inserir('wealth_place', [
  { tenant_id, name: 'Conta corrente', moeda: 'BRL', ordem: 1 },
  { tenant_id, name: 'Reserva de emergência', moeda: 'BRL', ordem: 2 },
  { tenant_id, name: 'Conta em dólar', moeda: 'USD', ordem: 3 },
  { tenant_id, name: 'Carro', moeda: 'BRL', ordem: 4 },
  // Encerrada em junho: zerada e oculta (some da lista, histórico continua).
  { tenant_id, name: 'Conta Banco Antigo', moeda: 'BRL', ordem: 5, oculto_desde: `${A1}-06-01` },
])
const lugar = (n) => manuais.find((p) => p.name === n)?.id ?? automaticos.find((p) => p.origem === n).id

const snaps = []
MESES.forEach((m, i) => {
  const n = MESES.length - 1 - i // meses até hoje
  const foto = (id, valor) => snaps.push({ tenant_id, place_id: lugar(id), mes: `${m}-01`, valor: Math.max(0, Math.round(valor * 100) / 100) })
  foto('Conta corrente', 3500 + entre(-900, 1500))
  foto('Reserva de emergência', 15000 + i * 420)
  foto('Conta em dólar', 1500 + i * 60)
  foto('Carro', 68000 * Math.pow(0.992, i))
  foto('Conta Banco Antigo', m >= ym(A1, 6) ? 0 : 2500 + entre(-200, 200))
  foto('acao', (24000 - n * 260) * (1 + entre(-0.04, 0.04)))
  foto('fii', 9300 - n * 140 + entre(-150, 150))
  foto('renda_fixa', 24960 - n * 330)
  foto('cripto', Math.max(800, 4330 - n * 110 + entre(-450, 450)))
  foto('consorcio', 92700 - n * 3140)
})
await inserirEmLotes('wealth_snapshot', snaps)
console.log(`${snaps.length} fotos de patrimônio`)

console.log('\nDemo pronto.')
console.log(`   Login:  ${DEMO_EMAIL}`)
console.log(`   Senha:  ${senhaMostrada}`)
