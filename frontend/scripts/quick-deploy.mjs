// Quick deploy: deploy contract and print address
import { createClient, createAccount, generatePrivateKey } from 'genlayer-js'
import { localnet } from 'genlayer-js/chains'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONTRACT = path.join(__dirname, '..', '..', 'contracts', 'agent_arbiter.py')
const CODE = readFileSync(CONTRACT, 'utf8')
const account = createAccount(generatePrivateKey())
const client = createClient({ chain: localnet, account })

console.log('Account:', account.address)

// Fund
try {
  await client.fundAccount({ address: account.address, amount: 1e21 })
  console.log('Funded')
} catch (e) {
  console.error('Fund error:', e.message)
  process.exit(1)
}

// Deploy
console.log('Deploying...')
const txHash = await client.deployContract({ code: CODE, args: [] })
console.log('Tx:', txHash)

// Wait with retries
let receipt = null
for (let i = 0; i < 30; i++) {
  try {
    receipt = await client.waitForTransactionReceipt({ hash: txHash, status: 'FINALIZED', interval: 5000, retries: 1 })
    break
  } catch (e) {
    console.log(`Attempt ${i+1} failed: ${e.message?.slice(0, 80)}`)
  }
}

if (!receipt) {
  // Try ACCEPTED instead
  try {
    receipt = await client.getTransaction({ hash: txHash })
  } catch (e) {}
}

const addr = receipt?.to_address || receipt?.data?.contract_address
if (addr && addr !== '0x0000000000000000000000000000000000000000') {
  console.log('\n=== DEPLOYED ===')
  console.log('Address:', addr)
} else {
  console.log('Deploy may have succeeded but address not resolved. Check tx:', txHash)
  console.log('Receipt:', JSON.stringify(receipt, null, 2)?.slice(0, 2000))
}
