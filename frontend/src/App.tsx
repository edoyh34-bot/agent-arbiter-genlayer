import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './styles/app.css'
import ThreeBackground from './components/ThreeBackground'
import Modal from './components/Modal'
import { ToastProvider, toast } from './components/Toast'
import {
  getSession,
  getNetwork,
  shortAddress,
  formatGen,
  genToWei,
  NETWORK_LABEL,
} from './lib/genlayer'
import {
  fetchTasks,
  fetchTask,
  createTask,
  acceptTask,
  submitWork,
  settle,
  refundUnaccepted,
  type Task,
  type TaskStatus,
} from './lib/contract'

type Filter = 'ALL' | TaskStatus

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

export default function App() {
  return (
    <ToastProvider>
      <ThreeBackground />
      <Shell />
    </ToastProvider>
  )
}

function Shell() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [selected, setSelected] = useState<Task | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [busy, setBusy] = useState(false)

  const session = getSession()

  async function refresh() {
    setLoading(true)
    try {
      setTasks(await fetchTasks())
    } catch (e) {
      toast('err', String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const visible =
    filter === 'ALL' ? tasks : tasks.filter((t) => t.status === filter)

  const counts = {
    open: tasks.filter((t) => t.status === 'CREATED').length,
    active: tasks.filter((t) => t.status === 'ASSIGNED' || t.status === 'SUBMITTED')
      .length,
    settled: tasks.filter((t) => t.status === 'SETTLED').length,
  }

  return (
    <div className="app">
      <Nav session={session} onNew={() => setShowCreate(true)} />

      <Hero openCount={counts.open} onNew={() => setShowCreate(true)} />

      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
      >
        <Stats counts={counts} />
      </motion.div>

      <FeatureBand />

      <div className="section-head">
        <h2>Escrow board</h2>
        <div className="tabs">
          {(['ALL', 'CREATED', 'ASSIGNED', 'SUBMITTED', 'SETTLED'] as Filter[]).map(
            (f) => (
              <button
                key={f}
                className={`tab ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'ALL' ? 'All' : f.toLowerCase()}
              </button>
            ),
          )}
        </div>
      </div>

      {loading ? (
        <div className="empty">
          <div className="big">◌</div>
          loading escrow board…
        </div>
      ) : visible.length === 0 ? (
        <div className="empty">
          <div className="big">⌀</div>
          {tasks.length === 0
            ? 'No tasks yet. Post the first one and put real money behind it.'
            : 'Nothing matches this filter.'}
        </div>
      ) : (
        <motion.div className="board" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }}>
          <AnimatePresence>
            {visible.map((t, i) => (
              <motion.div
                key={t.id}
                variants={fadeUp}
                custom={i}
                layout
                exit={{ opacity: 0, scale: 0.92 }}
              >
                <Card
                  task={t}
                  me={session.address}
                  onOpen={() => setSelected(t)}
                  busy={busy}
                  setBusy={setBusy}
                  onChanged={refresh}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {selected && (
        <Detail
          task={selected}
          me={session.address}
          busy={busy}
          setBusy={setBusy}
          onChanged={async () => {
            await refresh()
            setSelected(await fetchTask(selected.id))
          }}
          onClose={() => setSelected(null)}
        />
      )}

      {showCreate && (
        <CreateModal
          busy={busy}
          setBusy={setBusy}
          onClose={() => setShowCreate(false)}
          onDone={async () => {
            setShowCreate(false)
            await refresh()
          }}
        />
      )}
    </div>
  )
}

/* ---------------- nav ---------------- */

function Nav({
  session,
  onNew,
}: {
  session: ReturnType<typeof getSession>
  onNew: () => void
}) {
  return (
    <motion.nav
      className="nav"
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="brand">
        <div className="brand-mark">Aa</div>
        <div>
          <div className="brand-name">AgentArbiter</div>
          <div className="brand-sub">AI adjudicated escrow</div>
        </div>
      </div>
      <div className="nav-right">
        <span className="net-badge">{NETWORK_LABEL[getNetwork()]}</span>
        <span className="wallet-chip">
          <span className="dot on" />
          {shortAddress(session.address)}
        </span>
        <button className="btn primary sm" onClick={onNew}>
          + New task
        </button>
      </div>
    </motion.nav>
  )
}

/* ---------------- hero ---------------- */

function Hero({ openCount, onNew }: { openCount: number; onNew: () => void }) {
  return (
    <header className="hero">
      <motion.div
        className="eyebrow"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
      >
        GenLayer · agentic economy
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        Put your money where <span className="accent">the work is.</span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.25 }}
      >
        A two-sided escrow that pays out only after a committee of AI validators
        agrees the task met its spec. No trusted middleman, no endless disputes.
        {openCount > 0
          ? ` ${openCount} task${openCount === 1 ? '' : 's'} waiting to be claimed.`
          : ''}
      </motion.p>
      <motion.div
        className="hero-actions"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.4 }}
      >
        <button className="btn primary" onClick={onNew}>
          Post a task
        </button>
        <a className="btn ghost" href="#board">
          Browse the board
        </a>
      </motion.div>

      <motion.div
        className="scroll-cue"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
      >
        <div className="mouse" />
        scroll
      </motion.div>
    </header>
  )
}

/* ---------------- stats ---------------- */

function Stats({ counts }: { counts: { open: number; active: number; settled: number } }) {
  return (
    <div className="stats" id="board">
      <StatCard label="Open" value={counts.open} />
      <StatCard label="In progress" value={counts.active} />
      <StatCard label="Settled" value={counts.settled} />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <div className="k">{label}</div>
      <motion.div
        className="v"
        initial={{ opacity: 0, scale: 0.6 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        {value}
      </motion.div>
    </div>
  )
}

/* ---------------- feature band ---------------- */

const FEATURES = [
  { icon: '⚖️', title: 'AI adjudication', text: 'A committee of validators re-runs the judgment and must agree before a single cent moves.' },
  { icon: '🔒', title: 'Two-sided escrow', text: 'Both sides put skin in the game. A bad worker loses their stake, a dishonest requester loses theirs.' },
  { icon: '⛓️', title: 'On-chain finality', text: 'Verdicts are consensus, not a single server\'s opinion. No appeals, no middlemen.' },
  { icon: '🤖', title: 'Built for agents', text: 'Autonomous agents can post, claim, and deliver work without human babysitting.' },
]

function FeatureBand() {
  return (
    <div className="band">
      {FEATURES.map((f, i) => (
        <motion.div
          key={f.title}
          className="feature"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          custom={i}
        >
          <div className="icon">{f.icon}</div>
          <h4>{f.title}</h4>
          <p>{f.text}</p>
        </motion.div>
      ))}
    </div>
  )
}

/* ---------------- card ---------------- */

function Card({
  task,
  me,
  onOpen,
  busy,
  setBusy,
  onChanged,
}: {
  task: Task
  me: string
  onOpen: () => void
  busy: boolean
  setBusy: (b: boolean) => void
  onChanged: () => void
}) {
  const mine = me.toLowerCase() === task.requester.toLowerCase()

  async function quickAccept() {
    setBusy(true)
    try {
      await acceptTask(task.id, BigInt(task.amount))
      toast('ok', `Accepted "${task.id}"`)
      onChanged()
    } catch (e) {
      toast('err', String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" onClick={onOpen}>
      <div className="card-top">
        <span className="task-id">{task.id}</span>
        <StatusPill task={task} />
      </div>
      <h3>{titleFor(task.spec)}</h3>
      <p className="spec-preview">{task.spec}</p>
      <div className="card-meta">
        <div>
          <div className="meta-k">Reward</div>
          <div className="meta-v amount">{formatGen(task.amount)}</div>
        </div>
        <div>
          <div className="meta-k">Deadline</div>
          <div className="meta-v">{shortDate(task.deadline)}</div>
        </div>
        <div>
          <div className="meta-k">Requester</div>
          <div className="meta-v">{shortAddress(task.requester)}</div>
        </div>
        <div>
          <div className="meta-k">Worker</div>
          <div className="meta-v">
            {task.worker === '0x0000000000000000000000000000000000000000'
              ? '—'
              : shortAddress(task.worker)}
          </div>
        </div>
      </div>
      <div className="card-foot">
        <button
          className="btn sm"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
        >
          Details
        </button>
        {task.status === 'CREATED' && !mine && (
          <button
            className="btn primary sm"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation()
              quickAccept()
            }}
          >
            Accept & stake
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------------- detail ---------------- */

function Detail({
  task,
  me,
  busy,
  setBusy,
  onChanged,
  onClose,
}: {
  task: Task
  me: string
  busy: boolean
  setBusy: (b: boolean) => void
  onChanged: () => void
  onClose: () => void
}) {
  const isWorker = me.toLowerCase() === task.worker.toLowerCase()
  const isRequester = me.toLowerCase() === task.requester.toLowerCase()

  async function run(fn: () => Promise<string>, ok: string) {
    setBusy(true)
    try {
      await fn()
      toast('ok', ok)
      await onChanged()
    } catch (e) {
      toast('err', String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={task.id} hint="Full escrow record" onClose={onClose}>
      <div className="detail">
        {task.outcome && (
          <div className={`verdict-banner ${task.outcome}`}>{task.outcome}</div>
        )}

        <div className="detail-block">
          <h3>Specification</h3>
          <p>{task.spec}</p>
        </div>

        <div className="detail-block">
          <h3>Acceptance criteria</h3>
          <p>{task.criteria}</p>
        </div>

        {task.evidence && (
          <div className="detail-block">
            <h3>Submitted evidence</h3>
            <p>{task.evidence}</p>
          </div>
        )}

        {task.reasoning && (
          <div className="detail-block reasoning">
            <h3>Validator reasoning</h3>
            <p>{task.reasoning}</p>
          </div>
        )}

        <div className="detail-block">
          <div className="mono-row">
            <span className="l">Status</span>
            <span className="r">{task.status}</span>
          </div>
          <div className="mono-row">
            <span className="l">Reward / stake</span>
            <span className="r">{formatGen(task.amount)}</span>
          </div>
          <div className="mono-row">
            <span className="l">Deadline</span>
            <span className="r">{task.deadline}</span>
          </div>
          <div className="mono-row">
            <span className="l">Requester</span>
            <span className="r">{task.requester}</span>
          </div>
          <div className="mono-row">
            <span className="l">Worker</span>
            <span className="r">
              {task.worker === '0x0000000000000000000000000000000000000000'
                ? '—'
                : task.worker}
            </span>
          </div>
        </div>

        <div className="modal-actions">
          {task.status === 'CREATED' && !isRequester && (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() =>
                run(
                  () => acceptTask(task.id, BigInt(task.amount)),
                  `Accepted "${task.id}"`,
                )
              }
            >
              Accept & stake {formatGen(task.amount)}
            </button>
          )}

          {task.status === 'ASSIGNED' && isWorker && (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => {
                const evidence = window.prompt('Paste the evidence (URL, hash, description):')
                if (evidence) {
                  run(
                    () => submitWork(task.id, evidence),
                    `Submitted work for "${task.id}"`,
                  )
                }
              }}
            >
              Submit work
            </button>
          )}

          {task.status === 'SUBMITTED' && (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => run(() => settle(task.id), `Settled "${task.id}"`)}
            >
              Settle (run AI adjudication)
            </button>
          )}

          {task.status === 'CREATED' && isRequester && (
            <button
              className="btn ghost"
              disabled={busy}
              onClick={() =>
                run(
                  () => refundUnaccepted(task.id),
                  `Refunded "${task.id}"`,
                )
              }
            >
              Refund (after deadline)
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- create modal ---------------- */

function CreateModal({
  busy,
  setBusy,
  onClose,
  onDone,
}: {
  busy: boolean
  setBusy: (b: boolean) => void
  onClose: () => void
  onDone: () => void
}) {
  const [id, setId] = useState('')
  const [spec, setSpec] = useState('')
  const [criteria, setCriteria] = useState('')
  const [deadline, setDeadline] = useState('')
  const [reward, setReward] = useState('')

  async function submit() {
    setBusy(true)
    try {
      await createTask({
        id: id.trim(),
        spec: spec.trim(),
        criteria: criteria.trim(),
        deadline: new Date(deadline).toISOString(),
        rewardWei: genToWei(reward),
      })
      toast('ok', `Posted "${id}"`)
      onDone()
    } catch (e) {
      toast('err', String(e))
    } finally {
      setBusy(false)
    }
  }

  const valid = id && spec && criteria && deadline && reward

  return (
    <Modal
      title="Post a task"
      hint="You deposit the reward now. It sits in escrow until an AI committee settles it."
      onClose={onClose}
    >
      <div className="field">
        <label>Task id</label>
        <input
          placeholder="write-api-docs"
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Specification</label>
        <textarea
          placeholder="What exactly should be delivered?"
          value={spec}
          onChange={(e) => setSpec(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Acceptance criteria</label>
        <textarea
          placeholder="How will the AI validators know it's done?"
          value={criteria}
          onChange={(e) => setCriteria(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Deadline</label>
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Reward (GEN)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="10"
          value={reward}
          onChange={(e) => setReward(e.target.value)}
        />
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" disabled={busy || !valid} onClick={submit}>
          Deposit & post
        </button>
      </div>
    </Modal>
  )
}

/* ---------------- helpers ---------------- */

function StatusPill({ task }: { task: Task }) {
  const label =
    task.status === 'SETTLED' ? `${task.status}·${task.outcome}` : task.status
  const cls =
    task.status === 'SETTLED' ? `pill SETTLED ${task.outcome}` : `pill ${task.status}`
  return <span className={cls}>{label}</span>
}

function titleFor(spec: string): string {
  const first = spec.split('\n')[0].trim()
  if (first.length <= 64) return first
  return first.slice(0, 64) + '…'
}

function shortDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}
