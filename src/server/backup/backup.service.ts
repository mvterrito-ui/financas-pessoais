import { exigirTenant, type AuthContext } from '@/server/auth/context'
import { buscarTudo, ok } from '@/server/fluxo/crud'

// Tabelas com dados do usuário, na ordem em que uma restauração precisaria
// gravar (quem é referenciado vem antes de quem referencia).
export const TABELAS_BACKUP = [
  'annual_group',
  'annual_category',
  'annual_item',
  'annual_value',
  'budget_bucket',
  'account',
  'category',
  'recorrencia',
  'recorrencia_pausa',
  'recorrencia_valor',
  'transaction',
  'wealth_place',
  'wealth_snapshot',
  'acao',
  'fii',
  'fixed_income',
  'crypto_item',
  'crypto_summary',
  'consorcio',
  'consorcio_reajuste',
] as const

export const backupService = {
  /**
   * Tudo do usuário logado, num objeto só. O filtro por tenant é explícito:
   * pelo RLS um gerente enxerga outros usuários, e o backup é só da própria conta.
   */
  gerar: async (ctx: AuthContext) => {
    const tenantId = exigirTenant(ctx)
    const sb = ctx.supabase
    const [tenant, profile, ...dados] = await Promise.all([
      sb.from('tenant').select('*').eq('id', tenantId).single().then(ok),
      sb.from('profile').select('*').eq('id', ctx.userId).single().then(ok),
      ...TABELAS_BACKUP.map((t) =>
        buscarTudo((de, ate) => sb.from(t).select('*').eq('tenant_id', tenantId).order('id').range(de, ate)),
      ),
    ])
    return {
      app: 'financas-pessoais',
      versao: 1,
      gerado_em: new Date().toISOString(),
      tenant,
      profile,
      tabelas: Object.fromEntries(TABELAS_BACKUP.map((t, i) => [t, dados[i]])),
    }
  },
}
