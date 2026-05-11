import { http, createConfig } from 'wagmi'
import { mainnet, sepolia, arbitrumSepolia, baseSepolia } from 'wagmi/chains'
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors'

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

// Use Alchemy as primary (best CORS support for Vercel), fall back to public RPCs
const sepoliaRpc = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
  : 'https://rpc.ankr.com/eth_sepolia'

const arbitrumSepoliaRpc = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  ? `https://arb-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
  : 'https://sepolia-rollup.arbitrum.io/rpc'

const baseSepoliaRpc = 'https://base-sepolia.publicrpc.com'

export const config = createConfig({
  chains: [sepolia, arbitrumSepolia, baseSepolia, mainnet],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'FhenixDropBox' }),
    ...(walletConnectProjectId ? [walletConnect({ projectId: walletConnectProjectId })] : []),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(sepoliaRpc),
    [arbitrumSepolia.id]: http(arbitrumSepoliaRpc),
    [baseSepolia.id]: http(baseSepoliaRpc),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
