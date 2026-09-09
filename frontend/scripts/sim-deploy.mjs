// Deploy via sim_deploy RPC with array params
const resp = await fetch('http://localhost:4000/api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'sim_deploy',
    params: ['contracts/agent_arbiter.py'],
    id: 1
  }),
  signal: AbortSignal.timeout(60000)
})
const result = await resp.json()
console.log('Result:', JSON.stringify(result, null, 2))
if (result.result) console.log('Address:', result.result.contract_address)
