import type { Metadata } from 'next'
import { Geist, Geist_Mono, IBM_Plex_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const _ibmPlexSans = IBM_Plex_Sans({ weight: ["300", "400", "500", "600"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'FhenixDropBox - Privacy-First File Sharing',
  description: 'Decentralized file sharing with encrypted access control. Upload files securely, set private access rules, and share with complete privacy using Fhenix FHE technology.',
  keywords: ['Fhenix', 'privacy', 'file sharing', 'decentralized', 'FHE', 'encrypted', 'IPFS', 'blockchain'],
  authors: [{ name: 'FhenixDropBox' }],
  openGraph: {
    title: 'FhenixDropBox - Privacy-First File Sharing',
    description: 'Decentralized file sharing with encrypted access control using Fhenix FHE technology.',
    type: 'website',
  },
  icons: {
    icon: '/favicon.png',
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
