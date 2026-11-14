import { z } from 'zod'

/**
 * Schema de ATUALIZAÇÃO (PATCH) a partir do de criação.
 *
 * Por que não só `.partial()`: no Zod 4, um campo `.default(x)` continua
 * preenchendo o default mesmo dentro de `.partial()`. Aí um PATCH que manda só
 * `{ valor_aplicado }` chegava como `{ valor_aplicado, valor_atual: 0 }` e
 * ZERAVA o campo que o usuário não tocou. Aqui os defaults são removidos antes:
 * campo ausente continua ausente (o banco mantém o valor atual).
 */
export function parcial<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([k, v]) => [k, v instanceof z.ZodDefault ? v.unwrap() : v]),
  )
  return z.object(shape).partial() as unknown as ReturnType<z.ZodObject<T>['partial']>
}
