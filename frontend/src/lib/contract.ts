import { getSession, getContractAddress } from './genlayer'
import type { ExecutionResult } from 'genlayer-js/types'

export type TaskStatus = 'CREATED' | 'ASSIGNED' | 'SUBMITTED' | 'SETTLED' | 'CANCELLED'
export type Outcome = 'APPROVED' | 'REJECTED' | 'UNDETERMINED' | ''

export interface Task {
  id: string
  spec: string
  criteria: string
  deadline: string
  amount: string
  requester: string
  worker: string
  status: TaskStatus
  evidence: string
  outcome: Outcome
  reasoning: string
}

interface RawTask {
  id: string
  spec: string
  criteria: string
  deadline: string
  amount: string | number | bigint
  requester: string
  worker: string
  status: TaskStatus
  evidence: string
  outcome: Outcome
  reasoning: string
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

export async function fetchTasks(): Promise<Task[]> {
  const { client } = getSession()
  const address = getContractAddress()

  const ids = (await client.readContract({
    address: address as `0x${string}`,
    functionName: 'get_task_ids',
    args: [],
  })) as string[]

  const tasks: Task[] = []
  for (const id of ids) {
    const raw = (await client.readContract({
      address: address as `0x${string}`,
      functionName: 'get_task',
      args: [id],
    })) as unknown as RawTask
    tasks.push(normalize(raw))
  }
  return tasks.sort((a, b) => a.id.localeCompare(b.id))
}

export async function fetchTask(id: string): Promise<Task> {
  const { client } = getSession()
  const address = getContractAddress()
  const raw = (await client.readContract({
    address: address as `0x${string}`,
    functionName: 'get_task',
    args: [id],
  })) as unknown as RawTask
  return normalize(raw)
}

function normalize(raw: RawTask): Task {
  return {
    ...raw,
    amount: raw.amount?.toString() ?? '0',
    worker: raw.worker ?? ZERO_ADDR,
  }
}

async function waitForResult(hash: string): Promise<void> {
  const { client } = getSession()
  const receipt = await client.waitForTransactionReceipt({
    hash: hash as any,
  })
  const result = (receipt as any).txExecutionResultName as ExecutionResult | undefined
  if (result === 'FINISHED_WITH_ERROR') {
    throw new Error('Transaction reverted by the contract')
  }
}

export async function createTask(params: {
  id: string
  spec: string
  criteria: string
  deadline: string
  rewardWei: bigint
}): Promise<string> {
  const { client } = getSession()
  const address = getContractAddress()
  const hash = await client.writeContract({
    address: address as `0x${string}`,
    functionName: 'create_task',
    args: [params.id, params.spec, params.criteria, params.deadline],
    value: params.rewardWei,
  })
  await waitForResult(hash)
  return hash
}

export async function acceptTask(id: string, stakeWei: bigint): Promise<string> {
  const { client } = getSession()
  const address = getContractAddress()
  const hash = await client.writeContract({
    address: address as `0x${string}`,
    functionName: 'accept_task',
    args: [id],
    value: stakeWei,
  })
  await waitForResult(hash)
  return hash
}

export async function submitWork(id: string, evidence: string): Promise<string> {
  const { client } = getSession()
  const address = getContractAddress()
  const hash = await client.writeContract({
    address: address as `0x${string}`,
    functionName: 'submit_work',
    args: [id, evidence],
    value: 0n,
  })
  await waitForResult(hash)
  return hash
}

export async function settle(id: string): Promise<string> {
  const { client } = getSession()
  const address = getContractAddress()
  const hash = await client.writeContract({
    address: address as `0x${string}`,
    functionName: 'settle',
    args: [id],
    value: 0n,
  })
  await waitForResult(hash)
  return hash
}

export async function refundUnaccepted(id: string): Promise<string> {
  const { client } = getSession()
  const address = getContractAddress()
  const hash = await client.writeContract({
    address: address as `0x${string}`,
    functionName: 'refund_unaccepted',
    args: [id],
    value: 0n,
  })
  await waitForResult(hash)
  return hash
}
