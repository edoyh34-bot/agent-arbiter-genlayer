import { Router } from 'express'
import { getContractClient, writeContract, readContract, getAddress } from '../lib/client.mjs'
import { upsertTask, getTask, getAllTasks, getStats, syncFromContract } from '../lib/db.mjs'

const router = Router()

// GET /api/tasks - list all tasks (optionally filter by status)
router.get('/', async (req, res) => {
  try {
    const status = req.query.status
    const tasks = getAllTasks(status)
    res.json({ tasks, count: tasks.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/tasks/:id - get task details
router.get('/:id', async (req, res) => {
  try {
    const task = getTask(req.params.id)
    if (!task) {
      // Try reading from contract directly
      const contractTask = await readContract('get_task', [req.params.id])
      if (contractTask && contractTask.status) {
        return res.json(contractTask)
      }
      return res.status(404).json({ error: 'Task not found' })
    }
    res.json(task)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/tasks - create a new task
router.post('/', async (req, res) => {
  try {
    const { id, spec, criteria, deadline, reward } = req.body
    if (!id || !spec || !criteria || !deadline || !reward) {
      return res.status(400).json({ error: 'Missing required fields: id, spec, criteria, deadline, reward' })
    }
    const rewardWei = BigInt(Math.round(reward * 10 ** 6)) * 10n ** 12n
    const hash = await writeContract('create_task', [id, spec, criteria, deadline], rewardWei)
    upsertTask({ id, status: 'CREATED', requester: getAddress(), spec, criteria, deadline, reward_wei: rewardWei.toString() })
    res.json({ success: true, hash, taskId: id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/tasks/:id/accept - accept a task
router.post('/:id/accept', async (req, res) => {
  try {
    const task = await readContract('get_task', [req.params.id])
    if (!task || task.status !== 'CREATED') {
      return res.status(400).json({ error: 'Task not open for acceptance' })
    }
    const stake = BigInt(task.amount)
    const hash = await writeContract('accept_task', [req.params.id], stake)
    upsertTask({ ...task, worker: getAddress(), status: 'ASSIGNED', stake_wei: stake.toString() })
    res.json({ success: true, hash })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/tasks/:id/submit - submit work
router.post('/:id/submit', async (req, res) => {
  try {
    const { evidence } = req.body
    if (!evidence) return res.status(400).json({ error: 'evidence is required' })
    const hash = await writeContract('submit_work', [req.params.id, evidence])
    res.json({ success: true, hash })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/tasks/:id/settle - settle via AI adjudication
router.post('/:id/settle', async (req, res) => {
  try {
    const hash = await writeContract('settle', [req.params.id])
    res.json({ success: true, hash })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/tasks/:id/refund - refund unaccepted task
router.post('/:id/refund', async (req, res) => {
  try {
    const hash = await writeContract('refund_unaccepted', [req.params.id])
    res.json({ success: true, hash })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/tasks/sync - sync tasks from contract to local DB
router.post('/sync', async (req, res) => {
  try {
    const taskIds = await readContract('get_task_ids')
    const count = syncFromContract(taskIds, (id) => readContract('get_task', [id]))
    res.json({ success: true, synced: count })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
