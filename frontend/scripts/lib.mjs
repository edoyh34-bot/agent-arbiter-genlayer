// A shared client helper for the autonomous agents.
import { createClient, createAccount, generatePrivateKey } from 'genlayer-js'
import { localnet, testnetBradbury } from 'genlayer-js/chains'

export const NETWORK = process.env.NETWORK === 'testnet' ? testnetBradbury : localnet

export function makeAccount(key) {
  return createAccount(key || generatePrivateKey())
}

export function makeClient(account) {
  return createClient({ chain: NETWORK, account })
}

export async function fund(client, address, gen = 100) {
  if (NETWORK.id !== localnet.id) {
    // On a real network, funding comes from a faucet — can't auto-fund here.
    return false
  }
  await client.fundAccount({ address, amount: Number(BigInt(gen) * 10n ** 18n) })
  return true
}

export async function write(client, contract, functionName, args, value = 0n) {
  const hash = await client.writeContract({
    address: contract,
    functionName,
    args,
    value,
  })
  await client.waitForTransactionReceipt({ hash, status: 'FINALIZED' })
  return hash
}

export async function read(client, contract, functionName, args = []) {
  return client.readContract({ address: contract, functionName, args })
}
