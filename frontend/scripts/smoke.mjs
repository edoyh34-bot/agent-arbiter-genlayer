// End-to-end smoke test against the deployed AgentArbiter on glsim (localnet).
// Usage: node scripts/smoke.mjs <contractAddress>
import { createClient, createAccount, generatePrivateKey } from 'genlayer-js'
import { localnet } from 'genlayer-js/chains'

const CONTRACT = process.argv[2]
if (!CONTRACT) {
  console.error('Usage: node scripts/smoke.mjs <contractAddress>')
  process.exit(1)
}

const log = (label, value) => console.log(`\n[${label}]`, value)

async function fund(client, address, amount = 100000n * 10n ** 18n) {
  await client.fundAccount({ address, amount: Number(amount) })
}

async function main() {
  // Three parties: requester (alice), worker (bob), observer (charlie).
  const alice = createAccount(generatePrivateKey())
  const bob = createAccount(generatePrivateKey())
  const charlie = createAccount(generatePrivateKey())

  const aliceClient = createClient({ chain: localnet, account: alice })
  const bobClient = createClient({ chain: localnet, account: bob })
  const charlieClient = createClient({ chain: localnet, account: charlie })

  await fund(aliceClient, alice.address)
  await fund(bobClient, bob.address)
  await fund(charlieClient, charlie.address)
  log('funded', 'alice, bob, charlie')

  const reward = 1000000000000000000n // 1 GEN

  // 1. alice creates a task
  const createTx = await aliceClient.writeContract({
    address: CONTRACT,
    functionName: 'create_task',
    args: ['smoke-task', 'Write a 2-sentence summary of GenLayer', 'Summary is 2 sentences and mentions GenLayer', '2099-01-01T00:00:00Z'],
    value: reward,
  })
  await aliceClient.waitForTransactionReceipt({ hash: createTx, status: 'FINALIZED' })
  log('create_task', createTx)

  let task = await aliceClient.readContract({
    address: CONTRACT,
    functionName: 'get_task',
    args: ['smoke-task'],
  })
  log('task after create', task)
  if (task.status !== 'CREATED') throw new Error('Expected CREATED')

  // 2. bob accepts (stakes equal reward)
  const acceptTx = await bobClient.writeContract({
    address: CONTRACT,
    functionName: 'accept_task',
    args: ['smoke-task'],
    value: reward,
  })
  await bobClient.waitForTransactionReceipt({ hash: acceptTx, status: 'FINALIZED' })
  log('accept_task', acceptTx)

  // 3. bob submits work
  const submitTx = await bobClient.writeContract({
    address: CONTRACT,
    functionName: 'submit_work',
    args: ['smoke-task', 'Summary of GenLayer delivered at https://example.com/summary'],
    value: 0n,
  })
  await bobClient.waitForTransactionReceipt({ hash: submitTx, status: 'FINALIZED' })
  log('submit_work', submitTx)

  // 4. charlie (anyone) settles — runs AI adjudication
  const settleTx = await charlieClient.writeContract({
    address: CONTRACT,
    functionName: 'settle',
    args: ['smoke-task'],
    value: 0n,
  })
  const settleReceipt = await charlieClient.waitForTransactionReceipt({
    hash: settleTx,
    status: 'FINALIZED',
  })
  log('settle', settleTx)

  task = await charlieClient.readContract({
    address: CONTRACT,
    functionName: 'get_task',
    args: ['smoke-task'],
  })
  log('task after settle', task)

  if (task.status !== 'SETTLED') throw new Error('Expected SETTLED')
  if (!['APPROVED', 'REJECTED', 'UNDETERMINED'].includes(task.outcome)) {
    throw new Error('Unexpected outcome: ' + task.outcome)
  }

  console.log('\n=== SMOKE TEST PASSED ===')
  console.log('Final outcome:', task.outcome)
  console.log('Validator reasoning:', task.reasoning)
}

main().catch((e) => {
  console.error('Smoke test failed:', e)
  process.exit(1)
})
