import { http, createConfig } from 'wagmi'
import { mainnet, sepolia, arbitrumSepolia, baseSepolia } from 'wagmi/chains'
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo'

export const config = createConfig({
  chains: [sepolia, arbitrumSepolia, baseSepolia, mainnet],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'FhenixDropBox' }),
    walletConnect({ projectId }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http('https://ethereum-sepolia.publicnode.com'),
    [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
