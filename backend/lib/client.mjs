import { createClient, createAccount, generatePrivateKey } from 'genlayer-js'
import { localnet, testnetBradbury } from 'genlayer-js/chains'

const NETWORK = process.env.NETWORK === 'testnet' ? testnetBradbury : localnet
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS

let client = null
let account = null

function getAccount() {
  if (!account) {
    const key = process.env.ACCOUNT_PRIVATE_KEY || generatePrivateKey()
    account = createAccount(key)
  }
  return account
}

export function getContractClient() {
  if (!client) {
    const acct = getAccount()
    client = createClient({
      chain: NETWORK,
      account: acct,
    })
  }
  return client
}

export async function fundAccount(gen = 1000) {
  const acct = getAccount()
  if (NETWORK.id !== localnet.id) return false
  await client.fundAccount({
    address: acct.address,
    amount: Number(BigInt(gen) * 10n ** 18n),
  })
  return true
}

export async function writeContract(fn, args, value = 0n) {
  const c = getContractClient()
  const hash = await c.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: fn,
    args,
    value,
  })
  await c.waitForTransactionReceipt({ hash, status: 'FINALIZED' })
  return hash
}

export async function readContract(fn, args = []) {
  const c = getContractClient()
  return c.readContract({
    address: CONTRACT_ADDRESS,
    functionName: fn,
    args,
  })
}

export function getAddress() {
  return getAccount().address
}

export function getNetworkName() {
  return NETWORK.id === localnet.id ? 'localnet' : 'testnet'
}
