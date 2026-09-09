// Debug: test the LLM adjudication path directly
import { createClient, createAccount, generatePrivateKey } from 'genlayer-js'
import { localnet } from 'genlayer-js/chains'
import { ExecutionResult } from 'genlayer-js/types'

const CONTRACT = process.argv[2]
if (!CONTRACT) { console.error('Usage: node scripts/debug-llm.mjs <contract>'); process.exit(1) }

const account = createAccount()
const client = createClient({ chain: localnet, account })
await client.fundAccount({ address: account.address, amount: Number(1000n * 10n ** 18n) })
console.log('funded', account.address)

const write = async (fn, args, value = 0n) => {
  const h = await client.writeContract({ address: CONTRACT, functionName: fn, args, value })
  const r = await client.waitForTransactionReceipt({ hash: h, status: 'FINALIZED' })
  console.log(`${fn} → exec: ${r.txExecutionResultName}`)
  return r
}

const read = (fn, args) => client.readContract({ address: CONTRACT, functionName: fn, args })

// Create
await write('create_task', ['dbg-evidence-test', 'Summarize GenLayer in 2 sentences', 'Must mention Optimistic Democracy', '2099-01-01T00:00:00Z'], 1000000000000000000n)
// Accept
await write('accept_task', ['dbg-evidence-test'], 1000000000000000000n)
// Submit
await write('submit_work', ['dbg-evidence-test', 'GenLayer uses Optimistic Democracy where validators judge whether agent deliverables meet a natural-language spec. It settles disputes without a trusted middleman.'], 0n)

// Settle — this runs the LLM judge
console.log('--- calling settle ---')
await write('settle', ['dbg-evidence-test'], 0n)

// Read result
const result = await read('get_task', ['dbg-evidence-test'])
console.log('OUTCOME:', result.outcome)
console.log('REASONING:', result.reasoning)
console.log('STATUS:', result.status)
