// Deploy via sim_deploy RPC (direct, no consensus polling)
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const contractPath = path.join(__dirname, '..', '..', 'contracts', 'agent_arbiter.py')
const code = readFileSync(contractPath, 'utf8')

async function deploy() {
  const resp = await fetch('http://localhost:4000/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'sim_deploy',
      params: [{
        code_path: 'contracts/agent_arbiter.py',
        args: [],
        sender: '0x0000000000000000000000000000000000000001'
      }],
      id: 1
    })
  })

  const result = await resp.json()
  if (result.error) {
    console.error('Deploy error:', result.error.message)
    process.exit(1)
  }

  const addr = result.result?.contract_address
  console.log('Contract address:', addr)

  if (addr && addr !== '0x0000000000000000000000000000000000000000') {
    console.log('\nSet in frontend/.env.local:')
    console.log('VITE_NETWORK=localnet')
    console.log(`VITE_CONTRACT_ADDRESS=${addr}`)
  }
}

deploy().catch(console.error)
