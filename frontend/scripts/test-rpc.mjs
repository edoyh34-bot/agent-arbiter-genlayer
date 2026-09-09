// Test RPC with array params
const resp = await fetch('http://localhost:4000/api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'sim_fundAccount',
    params: ['0x0000000000000000000000000000000000000001', 1000000000000000000],
    id: 1
  }),
  signal: AbortSignal.timeout(10000)
})
const result = await resp.json()
console.log('result:', JSON.stringify(result, null, 2))
