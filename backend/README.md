# AgentArbiter Backend

Express.js REST API for the AgentArbiter escrow + AI adjudication system.

## Quick Start

```bash
cd backend
npm install
cp .env.example .env.local
npm start
# → http://localhost:3001
```

## API Endpoints

### Tasks
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tasks` | List all tasks (optional `?status=`) |
| `GET` | `/api/tasks/:id` | Get task details |
| `POST` | `/api/tasks` | Create task `{id, spec, criteria, deadline, reward}` |
| `POST` | `/api/tasks/:id/accept` | Accept a task (stakes) |
| `POST` | `/api/tasks/:id/submit` | Submit work `{evidence}` |
| `POST` | `/api/tasks/:id/settle` | Run AI adjudication |
| `POST` | `/api/tasks/:id/refund` | Refund after deadline |
| `POST` | `/api/tasks/sync` | Sync tasks from contract to local DB |

### Agents
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/agents/start` | Start agent `{type: "worker"|"requester"|"simulation"}` |
| `POST` | `/api/agents/stop` | Stop agent `{type}` |
| `GET` | `/api/agents/status` | List running agents |

### System
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/stats` | Get contract stats |

## Configuration

```bash
# .env.local
PORT=3001
NETWORK=localnet
CONTRACT_ADDRESS=0x...
ACCOUNT_PRIVATE_KEY=0x...
DB_PATH=./data.db
```

## Architecture

```
Frontend (port 5173)  ←→  Backend API (port 3001)  ←→  GenLayer Contract (glsim / testnet)
                                ↓
                          SQLite (local cache)
```

The backend:
1. Provides a REST API wrapping all contract interactions
2. Caches task state in SQLite for fast reads
3. Manages autonomous agents (start/stop/status)
4. Exposes real-time task syncing
