// Autonomous requester agent.
//
// Periodically posts new tasks to the AgentArbiter contract with a random
// spec/criteria and reward. Demonstrates the "requester" half of the agentic
// economy. Run alongside agent-worker.mjs to see the full autonomous loop.
//
// Usage:
//   node scripts/agent-requester.mjs <contractAddress> [rewardGEN] [intervalMs]
import { makeAccount, makeClient, fund, write } from './lib.mjs'

const CONTRACT = process.argv[2]
const REWARD_GEN = Number(process.argv[3] || 1)
const INTERVAL_MS = Number(process.argv[4] || 15000)

if (!CONTRACT) {
  console.error('Usage: node scripts/agent-requester.mjs <contractAddress> [rewardGEN] [intervalMs]')
  process.exit(1)
}

const account = makeAccount()
const client = makeClient(account)

const SPECS = [
  {
    id: 'summarize-genlayer',
    spec: 'Write a 150-word summary of the GenLayer protocol',
    criteria: 'Summary is ~150 words, mentions Optimistic Democracy, and is factual',
  },
  {
    id: 'build-json-endpoint',
    spec: 'Build a JSON API endpoint that returns current network stats',
    criteria: 'Endpoint returns valid JSON with latency < 500ms',
  },
  {
    id: 'audit-prompt-injection',
    spec: 'Review a contract for prompt-injection vulnerabilities',
    criteria: 'Report lists concrete attack vectors and mitigations',
  },
  {
    id: 'scrape-price-feed',
    spec: 'Scrape and normalize a crypto price feed',
    criteria: 'Returns a single numeric price with a timestamp',
  },
]

let counter = 0

function nextSpec() {
  const s = SPECS[counter % SPECS.length]
  counter++
  return s
}

function futureDeadline(daysAhead = 7) {
  const d = new Date(Date.now() + daysAhead * 86400_000)
  return d.toISOString()
}

async function postTask() {
  const s = nextSpec()
  const uniqueId = `${s.id}-${Date.now()}`
  const rewardWei = BigInt(Math.round(REWARD_GEN * 10 ** 6)) * 10n ** 12n

  console.log(`[requester ${account.address.slice(0, 6)}] posting "${uniqueId}" (${REWARD_GEN} GEN)`)
  await write(
    client,
    CONTRACT,
    'create_task',
    [uniqueId, s.spec, s.criteria, futureDeadline()],
    rewardWei,
  )
  console.log(`[requester] posted "${uniqueId}"`)
}

async function main() {
  const funded = await fund(client, account.address, 10000)
  console.log('[requester] started | funded:', funded)
  console.log('[requester] posting every', INTERVAL_MS, 'ms')
  await postTask()
  setInterval(postTask, INTERVAL_MS)
}

main().catch((e) => {
  console.error('requester crashed:', e)
  process.exit(1)
})
