import express from 'express'
import cors from 'cors'
import tasksRouter from './routes/tasks.mjs'
import agentsRouter from './routes/agents.mjs'
import { initDB } from './lib/db.mjs'

const PORT = process.env.PORT || 3001
const app = express()

app.use(cors())
app.use(express.json())

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/tasks', tasksRouter)
app.use('/api/agents', agentsRouter)

// Stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const { getContractClient } = await import('./lib/client.mjs')
    const client = getContractClient()
    const contractAddress = process.env.CONTRACT_ADDRESS

    if (!contractAddress) {
      return res.json({ error: 'No contract configured' })
    }

    const taskIds = await client.readContract({
      address: contractAddress,
      functionName: 'get_task_ids',
      args: [],
    })

    let open = 0, assigned = 0, submitted = 0, settled = 0
    for (const id of taskIds) {
      const task = await client.readContract({
        address: contractAddress,
        functionName: 'get_task',
        args: [id],
      })
      switch (task.status) {
        case 'CREATED': open++; break
        case 'ASSIGNED': case 'SUBMITTED': assigned++; break
        case 'SETTLED': settled++; break
      }
    }

    res.json({ total: taskIds.length, open, active: assigned, settled })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Initialize DB and start
initDB()
app.listen(PORT, () => {
  console.log(`AgentArbiter backend running on http://localhost:${PORT}`)
  console.log(`Contract: ${process.env.CONTRACT_ADDRESS || 'not configured'}`)
})
