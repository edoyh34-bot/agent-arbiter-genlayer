import { Router } from 'express'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const router = Router()
const runningAgents = new Map()

function getDir() {
  return path.dirname(fileURLToPath(import.meta.url))
}

// POST /api/agents/start - start an agent
router.post('/start', (req, res) => {
  const { type } = req.body
  if (!['worker', 'requester', 'simulation'].includes(type)) {
    return res.status(400).json({ error: 'type must be worker, requester, or simulation' })
  }

  const contractAddress = process.env.CONTRACT_ADDRESS
  if (!contractAddress) {
    return res.status(400).json({ error: 'CONTRACT_ADDRESS not configured' })
  }

  const frontendDir = path.join(getDir(), '..', 'frontend')

  let script, args
  switch (type) {
    case 'worker':
      script = 'scripts/agent-worker.mjs'
      args = [contractAddress, '4000']
      break
    case 'requester':
      script = 'scripts/agent-requester.mjs'
      args = [contractAddress, '1', '15000']
      break
    case 'simulation':
      script = 'scripts/agent-simulation.mjs'
      args = [contractAddress]
      break
  }

  const child = spawn('node', [script, ...args], {
    cwd: frontendDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })

  const logs = []
  child.stdout.on('data', (data) => logs.push(data.toString()))
  child.stderr.on('data', (data) => logs.push(data.toString()))

  runningAgents.set(type, { process: child, logs, started: new Date() })

  child.on('exit', () => runningAgents.delete(type))

  res.json({ success: true, type, pid: child.pid })
})

// POST /api/agents/stop - stop an agent
router.post('/stop', (req, res) => {
  const { type } = req.body
  const agent = runningAgents.get(type)
  if (!agent) {
    return res.status(404).json({ error: `No running ${type} agent` })
  }
  agent.process.kill()
  runningAgents.delete(type)
  res.json({ success: true, type })
})

// GET /api/agents/status - get all running agents
router.get('/status', (req, res) => {
  const agents = []
  for (const [type, agent] of runningAgents) {
    agents.push({
      type,
      pid: agent.process.pid,
      started: agent.started,
      alive: !agent.process.killed,
      lastLogs: agent.logs.slice(-10),
    })
  }
  res.json({ agents })
})

// POST /api/agents/fund - fund an account
router.post('/fund', async (req, res) => {
  try {
    const { fundAccount, getAddress } = await import('../lib/client.mjs')
    const funded = await fundAccount(req.body.gen || 1000)
    res.json({ success: funded, address: getAddress() })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
