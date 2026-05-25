import type { Metadata } from 'next'
import { Geist, Geist_Mono, IBM_Plex_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const _ibmPlexSans = IBM_Plex_Sans({ weight: ["300", "400", "500", "600"], subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://fhenixdropbox.vercel.app'),
  applicationName: 'FhenixDropBox',
  title: 'FhenixDropBox - Privacy-First File Sharing',
  description: 'Decentralized file sharing with AES-encrypted IPFS files, on-chain access rules, payments, folders, previews, and webhook registration.',
  keywords: ['Fhenix', 'privacy', 'file sharing', 'decentralized', 'FHE', 'encrypted', 'IPFS', 'blockchain'],
  authors: [{ name: 'FhenixDropBox' }],
  creator: 'FhenixDropBox',
  publisher: 'FhenixDropBox',
  icons: {
    icon: [
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'FhenixDropBox - Privacy-First File Sharing',
    description: 'Decentralized file sharing with encrypted IPFS delivery and on-chain access control.',
    siteName: 'FhenixDropBox',
    type: 'website',
    images: [{ url: '/favicon.png', width: 512, height: 512, alt: 'FhenixDropBox' }],
  },
  twitter: {
    card: 'summary',
    title: 'FhenixDropBox - Privacy-First File Sharing',
    description: 'Encrypted IPFS sharing with Sepolia access control and production privacy tooling.',
    images: ['/favicon.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
