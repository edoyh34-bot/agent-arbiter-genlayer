// Deploy directly via sim_deploy RPC (bypasses consensus)
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const contractPath = path.join(__dirname, '..', '..', 'contracts', 'agent_arbiter.py')
const code = readFileSync(contractPath, 'utf8')
const codeHex = '0x' + Array.from(new TextEncoder().encode(code), b => b.toString(16).padStart(2, '0')).join('')

const resp = await fetch('http://localhost:4000/api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'sim_deploy',
    params: [{ code_path: 'agent_arbiter.py', args: [], sender: '0x0000000000000000000000000000000000000001' }],
    id: 1
  })
})

const result = await resp.json()
console.log(JSON.stringify(result, null, 2))
