// Parser PURO de extrato/fatura. Entende OFX (padrão de banco) e CSV simples.
// Devolve itens prontos pra virar lançamentos.

export type ParsedItem = {
  data: string // AAAA-MM-DD
  valor: number // sempre positivo
  tipo: 'entrada' | 'saida'
  descricao: string
  external_id?: string // id na origem (FITID do OFX) -> dedup
}

export type ParseResult = { formato: 'OFX' | 'CSV'; itens: ParsedItem[] }

export function parseStatement(texto: string): ParseResult {
  const t = texto.trim()
  if (/OFXHEADER|<OFX>/i.test(t)) return { formato: 'OFX', itens: parseOFX(t) }
  return { formato: 'CSV', itens: parseCSV(t) }
}

// ---- OFX -------------------------------------------------------------
function campo(bloco: string, tag: string): string | undefined {
  const m = bloco.match(new RegExp(`<${tag}>([^<\r\n]*)`, 'i'))
  return m?.[1]?.trim()
}

function parseOFX(texto: string): ParsedItem[] {
  let blocos = [...texto.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)].map((m) => m[1])
  // OFX sem tags de fechamento (SGML): divide pelo abre-tag.
  if (blocos.length === 0) blocos = texto.split(/<STMTTRN>/i).slice(1)

  const itens: ParsedItem[] = []
  for (const b of blocos) {
    const dt = campo(b, 'DTPOSTED')
    const amt = campo(b, 'TRNAMT')
    if (!dt || !amt) continue
    const n = parseFloat(amt.replace(',', '.'))
    if (!Number.isFinite(n)) continue
    itens.push({
      data: `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`,
      valor: Math.abs(n),
      tipo: n < 0 ? 'saida' : 'entrada', // OFX: negativo = gasto
      descricao: (campo(b, 'MEMO') || campo(b, 'NAME') || 'Lançamento').trim(),
      external_id: campo(b, 'FITID'),
    })
  }
  return itens
}

// ---- CSV (best-effort) ----------------------------------------------
function normalizaData(s: string): string | null {
  s = s.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return null
}

function parseNumero(s: string): number {
  s = s.replace(/[^\d.,-]/g, '')
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (s.includes(',')) s = s.replace(',', '.')
  return parseFloat(s)
}

function parseCSV(texto: string): ParsedItem[] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim())
  if (linhas.length === 0) return []
  const sep = (linhas[0].match(/;/g)?.length ?? 0) > (linhas[0].match(/,/g)?.length ?? 0) ? ';' : ','

  const header = linhas[0].toLowerCase().split(sep)
  const acha = (re: RegExp) => header.findIndex((h) => re.test(h))
  let iData = acha(/data|date/)
  let iValor = acha(/valor|amount|montante|value/)
  let iDesc = acha(/descri|t[íi]tulo|title|hist|memo|estabelec|lan[çc]/)
  const temHeader = iData >= 0 && iValor >= 0
  // Sem header reconhecível: assume colunas [data, descrição, valor] (ex: Nubank).
  if (!temHeader) {
    iData = 0
    iDesc = 1
    iValor = 2
  }

  const itens: ParsedItem[] = []
  for (const linha of linhas.slice(temHeader ? 1 : 0)) {
    const cols = linha.split(sep)
    const data = normalizaData(cols[iData] ?? '')
    const n = parseNumero(cols[iValor] ?? '')
    if (!data || !Number.isFinite(n)) continue
    const descricao = (cols[iDesc] ?? '').trim() || 'Lançamento'
    itens.push({
      data,
      valor: Math.abs(n),
      tipo: n >= 0 ? 'saida' : 'entrada', // CSV de fatura: positivo = gasto
      descricao,
      external_id: `csv:${data}:${n}:${descricao}`.slice(0, 200),
    })
  }
  return itens
}
