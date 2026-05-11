import type { Metadata } from 'next'
import { Geist, Geist_Mono, IBM_Plex_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const _ibmPlexSans = IBM_Plex_Sans({ weight: ["300", "400", "500", "600"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'FhenixDropBox - Privacy-First File Sharing',
  description: 'Decentralized file sharing with AES-encrypted IPFS files, on-chain access rules, payments, folders, previews, and webhook registration.',
  keywords: ['Fhenix', 'privacy', 'file sharing', 'decentralized', 'FHE', 'encrypted', 'IPFS', 'blockchain'],
  authors: [{ name: 'FhenixDropBox' }],
  openGraph: {
    title: 'FhenixDropBox - Privacy-First File Sharing',
    description: 'Decentralized file sharing with encrypted IPFS delivery and on-chain access control.',
    type: 'website',
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
