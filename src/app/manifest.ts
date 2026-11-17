import type { MetadataRoute } from 'next'

// Ícone e nome quando o app é adicionado à tela inicial do celular.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Finanças',
    short_name: 'Finanças',
    description: 'Caixa, patrimônio e investimentos',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a100e',
    theme_color: '#0a100e',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
