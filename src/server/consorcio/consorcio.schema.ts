import { z } from 'zod'
import { parcial } from '@/server/zod-util'

const base = z.object({
  nome: z.string().trim().min(1, 'Informe um nome').max(80),
  administradora: z.string().trim().max(80).nullable().optional(),
  tipo: z.enum(['imovel', 'veiculo', 'servico', 'outro']).optional().default('outro'),
  valor_carta: z.number().min(0).optional().default(0),
  prazo_meses: z.number().int().min(1, 'Prazo mínimo de 1 mês').max(400),
  parcelas_pagas: z.number().int().min(0).optional().default(0),
  valor_parcela: z.number().min(0).optional().default(0),
  status: z.enum(['ativo', 'contemplado', 'encerrado']).optional().default('ativo'),
})

export const consorcioCreateSchema = base.refine((d) => d.parcelas_pagas <= d.prazo_meses, {
  message: 'Parcelas pagas não pode passar do prazo',
  path: ['parcelas_pagas'],
})

// PATCH: sem defaults (não zera o que não veio). A regra pagas ≤ prazo também
// fica garantida pelo CHECK do banco quando só um dos dois é enviado.
export const consorcioUpdateSchema = parcial(base).refine(
  (d) => d.parcelas_pagas === undefined || d.prazo_meses === undefined || d.parcelas_pagas <= d.prazo_meses,
  { message: 'Parcelas pagas não pode passar do prazo', path: ['parcelas_pagas'] },
)

// Reajuste: a partir da parcela nº X, o valor passa a ser Y (upsert por parcela).
export const reajusteSetSchema = z.object({
  consorcio_id: z.string().uuid(),
  a_partir_parcela: z.number().int().min(1).max(400),
  valor_parcela: z.number().min(0),
})
