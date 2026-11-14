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
  if (/OFXHEADER|<OFX>/i.test(t)) return { formato: 'OFX', itens: idsUnicos(parseOFX(t)) }
  return { formato: 'CSV', itens: idsUnicos(parseCSV(t)) }
}

/**
 * Duas compras IGUAIS no mesmo arquivo (ex: 2× "Uber 15,90" no mesmo dia)
 * geravam o mesmo external_id -> o índice único rejeitava a importação toda.
 * A 2ª, 3ª… ocorrência ganha sufixo "#2", "#3". Determinístico: reimportar o
 * mesmo arquivo gera os mesmos ids e continua sem duplicar.
 */
export function idsUnicos(itens: ParsedItem[]): ParsedItem[] {
  const vistos = new Map<string, number>()
  return itens.map((i) => {
    if (!i.external_id) return i
    const n = (vistos.get(i.external_id) ?? 0) + 1
    vistos.set(i.external_id, n)
    return n === 1 ? i : { ...i, external_id: `${i.external_id}#${n}`.slice(0, 200) }
  })
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
      descricao: (campo(b, 'MEMO') || campo(b, 'NAME') || 'Lançamento').trim().slice(0, 200),
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

export function parseNumero(s: string): number {
  s = s.replace(/[^\d.,-]/g, '')
  // Só ponto, em grupos de 3 ("1.234", "12.345.678"): milhar no formato BR.
  if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) return parseFloat(s.replace(/\./g, ''))
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (s.includes(',')) s = s.replace(',', '.')
  return parseFloat(s)
}

/** Divide uma linha de CSV respeitando aspas ("Padaria, centro" é 1 coluna). */
export function dividirLinha(linha: string, sep: string): string[] {
  const cols: string[] = []
  let atual = ''
  let aspas = false
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i]
    if (ch === '"') {
      if (aspas && linha[i + 1] === '"') {
        atual += '"' // "" dentro de aspas = aspas literal
        i++
      } else aspas = !aspas
    } else if (ch === sep && !aspas) {
      cols.push(atual)
      atual = ''
    } else atual += ch
  }
  cols.push(atual)
  return cols
}

function parseCSV(texto: string): ParsedItem[] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim())
  if (linhas.length === 0) return []
  const sep = (linhas[0].match(/;/g)?.length ?? 0) > (linhas[0].match(/,/g)?.length ?? 0) ? ';' : ','

  const header = dividirLinha(linhas[0].toLowerCase(), sep)
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
    const cols = dividirLinha(linha, sep)
    const data = normalizaData(cols[iData] ?? '')
    const n = parseNumero(cols[iValor] ?? '')
    if (!data || !Number.isFinite(n)) continue
    const descricao = ((cols[iDesc] ?? '').trim() || 'Lançamento').slice(0, 200)
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
