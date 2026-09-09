# AgentArbiter

**Agent-to-agent escrow with AI adjudication** on GenLayer.

Two autonomous agents (or humans) agree on a task. The requester deposits the
task reward, the worker deposits an equal good-faith stake, and after the
worker submits evidence a GenLayer validator committee judges — on-chain and
neutrally — whether the work satisfies the spec. This fills the exact gap
GenLayer describes: *"every layer engineers the happy path, none ships dispute
resolution."*

## Why this fits GenLayer

Agent-to-agent commitments are one of GenLayer's canonical use cases. A
deterministic smart contract can't tell whether a delivered API, article, or
report actually meets a natural-language spec. This contract:

- **Fetches nothing** — the evidence is self-describing and committed by the
  worker (immutable once submitted), so validators have stable input to judge.
- **Judges with an LLM** via `gl.nondet.exec_prompt` inside an equivalence
  block, so the verdict is consensus-critical, not a single server's opinion.
- **Settles deterministically** — the escrow math is pure code, so the money
  movement is fully predictable once the verdict is accepted.

## Lifecycle

```
CREATED ──▶ ASSIGNED ──▶ SUBMITTED ──▶ SETTLED
   │           ▲                          ▲
   │ (worker accepts + stake)             │ (AI verdict)
   └──────────────────────────────────────┘
   │
   └──▶ CANCELLED  (deadline passes, requester refunds)
```

| State | Who acts | Value required |
|-------|----------|----------------|
| `CREATED` | requester calls `create_task` | `amount` (reward) |
| `ASSIGNED` | worker calls `accept_task` | `amount` (stake) |
| `SUBMITTED` | worker calls `submit_work` | — (evidence) |
| `SETTLED` | anyone calls `settle` | — (AI adjudication) |
| `CANCELLED` | requester calls `refund_unaccepted` | — (after deadline) |

## Settlement math

| Verdict | Worker gets | Requester gets |
|---------|-------------|----------------|
| `APPROVED` | `amount + stake` | `0` |
| `REJECTED` | `0` | `amount + stake` |
| `UNDETERMINED` | `amount` | `stake` (both refunded) |

The two-sided stake means neither party can grief the other for free: a bad
worker loses their stake, and a dishonest requester has real money locked up.

## Contract

`contracts/agent_arbiter.py`

- `create_task(task_id, spec, criteria, deadline)` — payable, deposits reward.
- `accept_task(task_id)` — payable, deposits an equal stake, locks the worker.
- `submit_work(task_id, evidence)` — worker commits evidence.
- `settle(task_id)` — runs the AI adjudicator and releases funds.
- `refund_unaccepted(task_id)` — requester reclaims the reward after the
  deadline if nobody accepted.
- `get_task(task_id)` / `get_task_ids()` — read-only views.

### The adjudicator

The `_judge` method builds a strict, JSON-only prompt from the task spec,
acceptance criteria, and evidence, then runs it through a custom
leader/validator pair (`gl.vm.run_nondet`). Validators re-run the same prompt
independently and the decision fields (`approved`, `undetermined`) must match
exactly, while free-text `reasoning` is allowed to differ — so the on-chain
outcome is a genuine consensus result rather than one operator's output.

## Project layout

```
contracts/
  agent_arbiter.py          # the Intelligent Contract
tests/
  direct/
    conftest.py             # address helper
    test_agent_arbiter.py   # direct-mode tests (web/LLM mocked)
frontend/
  src/
    App.tsx                 # board, detail, create-task modal
    lib/genlayer.ts         # client + wallet session
    lib/contract.ts         # contract read/write helpers
    components/             # Modal, Toast
    styles/                 # global + app css
  scripts/
    deploy.mjs              # deploy to glsim/localnet
    smoke.mjs               # end-to-end lifecycle test
    agent-requester.mjs     # autonomous task-posting agent
    agent-worker.mjs        # autonomous accept/deliver/settle agent
    agent-simulation.mjs    # run both agents together
    lib.mjs                 # shared client helpers
  index.html
  .env.example              # set VITE_CONTRACT_ADDRESS / VITE_NETWORK
gltest.config.yaml          # network configuration for the test suite
pyproject.toml              # pytest configuration
requirements.txt
```

## Run the tests

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt

pytest tests/direct/ -v        # fast, in-memory (~2s)
genvm-lint check contracts/agent_arbiter.py   # static analysis
```

The direct-mode runner downloads the GenVM contract SDK from GitHub releases
on first run and caches it under `~/.cache/gltest-direct`.

## Frontend

A Vite + React + TypeScript single-page app with a distinctive
ink-on-paper dark theme (no off-the-shelf component kit). It ships a board,
a task detail view with validator reasoning, and a create-task flow.

```bash
cd frontend
npm install
cp .env.example .env.local   # set VITE_CONTRACT_ADDRESS + VITE_NETWORK
npm run dev                  # http://localhost:5173
```

Set `VITE_NETWORK=localnet` to talk to a local Studio/glsim node, or
`VITE_NETWORK=testnet` for the Bradbury testnet. The app auto-creates and
persists a burner account in `localStorage`.

## Run locally (end-to-end)

No Docker needed — use `glsim`, the lightweight GenLayer simulator that ships
with the test suite.

```bash
# 1. Install the simulator extra + a mock LLM provider (for local demo)
pip install "genlayer-test[sim]"

# 2. Start the local network (chain id 61127, matching the frontend)
.venv\Scripts\glsim.exe --port 4000 --validators 5 --no-browser --llm-provider mock

# 3. Deploy the contract (prints the address)
cd frontend
node scripts/deploy.mjs

# 4. Point the frontend at the deployed contract
#    frontend/.env.local:
#    VITE_NETWORK=localnet
#    VITE_CONTRACT_ADDRESS=<address from step 3>

# 5. Run the UI
npm run dev                       # http://localhost:5173
```

The `--llm-provider mock` flag makes the simulator return a deterministic
verdict so the full lifecycle works without an API key. For real LLM
adjudication, use one of:

```bash
# OpenRouter (recommended — works with any provider)
OPENROUTER_API_KEY=<your-key> glsim.exe --llm-provider openrouter:openai/gpt-4o-mini

# OpenAI
OPENAI_API_KEY=<your-key> glsim.exe --llm-provider openai:gpt-4o-mini

# Anthropic
ANTHROPIC_API_KEY=<your-key> glsim.exe --llm-provider anthropic:claude-3-5-sonnet
```

An end-to-end smoke test exercises the whole flow against a deployed contract:

```bash
node scripts/smoke.mjs <contract-address>
```

## Autonomous agents

The project ships autonomous agents that play the two sides of the economy
with no human input:

- `scripts/agent-requester.mjs` — periodically posts tasks with a reward.
- `scripts/agent-worker.mjs` — watches for open tasks, accepts + stakes,
  produces evidence, submits it, and settles.
- `scripts/agent-simulation.mjs` — runs both together in one process.

```bash
# Full autonomous economy (requester + worker loop forever)
node scripts/agent-simulation.mjs <contract-address>

# Or run each side separately
node scripts/agent-requester.mjs <contract-address> [rewardGEN] [intervalMs]
node scripts/agent-worker.mjs <contract-address> [pollMs]
```

The worker's `doWork()` synthesizes evidence deterministically; swap it for a
real LLM/web call to make the agent produce genuine deliverables.

## Deploy to testnet Bradbury

```bash
genlayer network               # select testnet Bradbury
genlayer deploy                # runs the deploy script
```

Or use [studio.genlayer.com](https://studio.genlayer.com) for zero-setup
deployment and interaction.

## Roadmap

- [x] Two-sided escrow + AI adjudication contract
- [x] Direct-mode test suite (approved / rejected / undetermined)
- [x] `UNDETERMINED` path (mutual refund) wired into `settle`
- [x] Deadline enforcement (`refund_unaccepted` + acceptance guard)
- [x] Frontend (Vite + React, genlayer-js, custom design system)
- [x] End-to-end deploy + smoke test on glsim localnet
- [x] Autonomous agents (requester + worker) with 3D animated UI
- [ ] Testnet Bradbury deployment + Agent Tank submission
