import { redirect } from 'next/navigation'

// O Orçamento (baldes por %) virou "metas por grupo" no Controle Anual.
export default function OrcamentoPage() {
  redirect('/anual')
}
