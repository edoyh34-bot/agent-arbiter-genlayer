// Runs the full autonomous economy: a requester agent that posts tasks and a
// worker agent that accepts/delivers/settles them, in a single process.
//
// Usage:
//   node scripts/agent-simulation.mjs <contractAddress>
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const CONTRACT = process.argv[2]
if (!CONTRACT) {
  console.error('Usage: node scripts/agent-simulation.mjs <contractAddress>')
  process.exit(1)
}

const dir = path.dirname(fileURLToPath(import.meta.url))

const requester = spawn('node', [path.join(dir, 'agent-requester.mjs'), CONTRACT, '1', '15000'], { stdio: 'inherit' })
const worker = spawn('node', [path.join(dir, 'agent-worker.mjs'), CONTRACT, '4000'], { stdio: 'inherit' })

console.log('Autonomous economy running. Press Ctrl+C to stop.')

const shutdown = () => {
  requester.kill()
  worker.kill()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
