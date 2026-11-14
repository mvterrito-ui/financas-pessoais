/**
 * Erro "esperado", com mensagem pensada pro usuário e status HTTP certo.
 * Tudo que NÃO for ErroHttp/ZodError vira 500 com mensagem genérica (o
 * detalhe técnico do banco fica só no log do servidor).
 */
export class ErroHttp extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ErroHttp'
  }
}
