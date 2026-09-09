// Deploys the AgentArbiter contract to a running glsim (localnet) instance.
// Usage: node scripts/deploy.mjs
import { readFileSync } from 'node:fs'
import { createClient, createAccount, generatePrivateKey } from 'genlayer-js'
import { localnet } from 'genlayer-js/chains'

const CONTRACT_PATH = new URL('../../contracts/agent_arbiter.py', import.meta.url)

async function main() {
  const account = createAccount(generatePrivateKey())
  const client = createClient({ chain: localnet, account })

  console.log('Deployer address:', account.address)

  // Fund the deployer on localnet (sim_fundAccount).
  const fundAmount = Number(10n ** 18n * 1000n) // 1000 GEN (as Number for JSON)
  console.log('Funding account…')
  await client.fundAccount({ address: account.address, amount: fundAmount })
  console.log('Funded with', fundAmount, 'wei')

  const code = readFileSync(CONTRACT_PATH, 'utf8')
  console.log('Deploying AgentArbiter…')
  const txHash = await client.deployContract({
    code,
    args: [],
    consensusMaxRotations: 3,
  })
  console.log('Deploy tx:', txHash)

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: 'FINALIZED',
  })

  console.log('Raw receipt:', JSON.stringify(receipt, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2))

  const contractAddress =
    receipt.recipient ??
    receipt.to_address ??
    receipt.data?.contract_address ??
    receipt.txDataDecoded?.contractAddress

  if (!contractAddress) {
    console.error('Could not resolve contract address from receipt:', receipt)
    process.exit(1)
  }

  console.log('\n=== AgentArbiter deployed ===')
  console.log('Address:', contractAddress)
  console.log('Tx:', txHash)
  console.log('\nSet this in frontend/.env.local:')
  console.log(`VITE_CONTRACT_ADDRESS=${contractAddress}`)
  console.log('VITE_NETWORK=localnet')
}

main().catch((e) => {
  console.error('Deploy failed:', e)
  process.exit(1)
})
