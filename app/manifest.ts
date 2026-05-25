import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FhenixDropBox',
    short_name: 'FhenixDropBox',
    description: 'Privacy-first encrypted IPFS file sharing with on-chain access control.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F5F4F0',
    theme_color: '#111111',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/favicon.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
