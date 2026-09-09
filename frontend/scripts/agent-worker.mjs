// Autonomous worker agent.
//
// Watches the AgentArbiter contract for open tasks, accepts them, "does the
// work" (generates evidence), submits it, and monitors for settlement. Runs
// until interrupted (Ctrl+C).
//
// Usage:
//   node scripts/agent-worker.mjs <contractAddress> [pollMs]
import { makeAccount, makeClient, fund, write, read } from './lib.mjs'

const CONTRACT = process.argv[2]
const POLL_MS = Number(process.argv[3] || 5000)

if (!CONTRACT) {
  console.error('Usage: node scripts/agent-worker.mjs <contractAddress> [pollMs]')
  process.exit(1)
}

const account = makeAccount()
const client = makeClient(account)

const ZERO = '0x0000000000000000000000000000000000000000'
const handled = new Set()
let busy = false

function log(...args) {
  console.log(`[worker ${account.address.slice(0, 6)}]`, ...args)
}

async function doWork(task) {
  // Simulate producing a deliverable for the spec. In a real agent this would
  // call an LLM / build / scrape — here we synthesize evidence deterministically.
  const evidence = `https://deliverables.agent/${encodeURIComponent(task.id)}?spec=${encodeURIComponent(task.spec.slice(0, 40))}`
  log('delivered evidence for', task.id, '->', evidence)
  return evidence
}

async function settleIfReady(client, contract, task) {
  // After submitting, keep trying to settle until it's done.
  while (true) {
    await new Promise((r) => setTimeout(r, POLL_MS))
    try {
      const t = await read(client, contract, 'get_task', [task.id])
      if (t.status === 'SUBMITTED') {
        await write(client, contract, 'settle', [task.id], 0n)
        log('settled', task.id)
      }
      if (t.status === 'SETTLED') {
        log('OUTCOME', task.id, '->', t.outcome, t.reasoning ? `(${t.reasoning})` : '')
        return
      }
    } catch (e) {
      log('settle watch error:', String(e).slice(0, 120))
    }
  }
}

async function tick() {
  if (busy) return
  busy = true
  try {
    const ids = await read(client, CONTRACT, 'get_task_ids')
    for (const id of ids) {
      if (handled.has(id)) continue
      const task = await read(client, CONTRACT, 'get_task', [id])
      if (task.status !== 'CREATED') continue
      if (task.worker !== ZERO) continue

      handled.add(id)
      const reward = BigInt(task.amount)

      try {
        log('accepting', id, 'for', reward.toString(), 'wei stake')
        await write(client, CONTRACT, 'accept_task', [id], reward)

        const evidence = await doWork(task)
        await write(client, CONTRACT, 'submit_work', [id, evidence], 0n)
        log('submitted', id)

        // fire-and-forget settlement watching
        settleIfReady(client, CONTRACT, task)
      } catch (e) {
        log('failed to handle', id, ':', String(e).slice(0, 160))
        handled.delete(id)
      }
    }
  } catch (e) {
    log('poll error:', String(e).slice(0, 160))
  } finally {
    busy = false
  }
}

async function main() {
  const funded = await fund(client, account.address, 1000)
  log('started on', NETWORK_LABEL(), '| funded:', funded)
  log('watching contract', CONTRACT, 'every', POLL_MS, 'ms')
  await tick()
  setInterval(tick, POLL_MS)
}

function NETWORK_LABEL() {
  return process.env.NETWORK === 'testnet' ? 'Bradbury Testnet' : 'Localnet'
}

main().catch((e) => {
  console.error('worker crashed:', e)
  process.exit(1)
})
