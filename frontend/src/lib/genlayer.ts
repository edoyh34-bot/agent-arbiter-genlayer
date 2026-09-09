import { createClient, createAccount, generatePrivateKey } from 'genlayer-js'
import { localnet, testnetBradbury, studionet } from 'genlayer-js/chains'
import type { GenLayerClient } from 'genlayer-js/types'

export type NetworkId = 'localnet' | 'testnet' | 'studionet'

const CHAINS = {
  localnet,
  testnet: testnetBradbury,
  studionet,
} as const

export const NETWORK_LABEL: Record<NetworkId, string> = {
  localnet: 'Localnet',
  testnet: 'Bradbury Testnet',
  studionet: 'Studionet',
}

const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ??
  '0x0000000000000000000000000000000000000000'

const ACCOUNT_KEY = 'agent-arbiter:privateKey'

function readStoredKey(): `0x${string}` | undefined {
  try {
    const k = localStorage.getItem(ACCOUNT_KEY)
    return k ? (k as `0x${string}`) : undefined
  } catch {
    return undefined
  }
}

function persistKey(key: `0x${string}`) {
  try {
    localStorage.setItem(ACCOUNT_KEY, key)
  } catch {
    /* ignore */
  }
}

export interface Session {
  client: GenLayerClient<any>
  account: ReturnType<typeof createAccount>
  address: string
  network: NetworkId
}

let session: Session | null = null

export function getContractAddress(): string {
  return CONTRACT_ADDRESS
}

export function getNetwork(): NetworkId {
  return (import.meta.env.VITE_NETWORK as NetworkId) || 'localnet'
}

export function getSession(): Session {
  if (session) return session

  const network = getNetwork()
  const key = readStoredKey() ?? generatePrivateKey()
  persistKey(key)
  const account = createAccount(key)

  const client = createClient({
    chain: CHAINS[network],
    account,
  })

  session = {
    client,
    account,
    address: account.address,
    network,
  }
  return session
}

export function resetAccount() {
  try {
    localStorage.removeItem(ACCOUNT_KEY)
  } catch {
    /* ignore */
  }
  session = null
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function formatGen(wei: bigint | number | string): string {
  let value: bigint
  try {
    value = typeof wei === 'bigint' ? wei : BigInt(wei)
  } catch {
    value = 0n
  }
  const whole = value / 10n ** 18n
  const frac = value % 10n ** 18n
  if (frac === 0n) return `${whole.toString()} GEN`
  const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '')
  return `${whole.toString()}.${fracStr.slice(0, 4)} GEN`
}

export function genToWei(gen: string): bigint {
  const num = parseFloat(gen)
  if (Number.isNaN(num) || num <= 0) return 0n
  return BigInt(Math.round(num * 10 ** 6)) * 10n ** 12n
}
