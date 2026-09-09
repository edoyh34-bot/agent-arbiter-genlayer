# Deploy AgentArbiter to Studionet
import sys, json
sys.path.insert(0, '.venv/Lib/site-packages')

from genlayer_py import create_client, create_account
from genlayer_py.chains import studionet

account = create_account()
addr = account.address
print(f"Account: {addr}")

client = create_client(chain=studionet, account=account)

with open("contracts/agent_arbiter.py", "r") as f:
    code = f.read()

print(f"Contract: {len(code)} bytes")
tx_hash = client.deploy_contract(code=code, args=[])
print(f"TX: {tx_hash}")

# Wait for acceptance (may take several seconds)
for i in range(60):
    try:
        receipt = client.wait_for_transaction_receipt(
            transaction_hash=tx_hash,
            status="ACCEPTED",
            interval=5,
            retries=1,
        )
        break
    except Exception as e:
        if i < 5:
            print(f"Waiting... ({e})")
        continue

# Extract contract address from receipt
if isinstance(receipt, dict):
    ca = receipt.get("data", {}).get("contract_address")
    if not ca:
        ca = receipt.get("data", {}).get("to_address")
    if not ca:
        ca = receipt.get("to_address")
    print(f"\nReceipt data: {json.dumps(receipt, default=str)[:800]}")
else:
    print(f"\nReceipt type: {type(receipt)}: {str(receipt)[:800]}")

if ca:
    print(f"\n=== DEPLOYED ON STUDIONET ===")
    print(f"Account: {addr}")
    print(f"Contract: {ca}")
    print(f"\nFrontend config:")
    print(f"  VITE_NETWORK=testnet")
    print(f"  VITE_CONTRACT_ADDRESS={ca}")
else:
    print("Could not extract contract address from receipt")
