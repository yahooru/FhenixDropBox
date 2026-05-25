import { fallback, http, createConfig } from 'wagmi'
import { mainnet, sepolia, arbitrumSepolia, baseSepolia } from 'wagmi/chains'
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors'

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

// Use Alchemy as primary when configured, then public RPCs that do not require browser API keys.
const sepoliaTransports = [
  ...(process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
    ? [http(`https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`)]
    : []),
  http('https://ethereum-sepolia.publicnode.com'),
  http('https://1rpc.io/sepolia'),
  http('https://sepolia.drpc.org'),
]

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
    [sepolia.id]: fallback(sepoliaTransports),
    [arbitrumSepolia.id]: http(arbitrumSepoliaRpc),
    [baseSepolia.id]: http(baseSepoliaRpc),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
