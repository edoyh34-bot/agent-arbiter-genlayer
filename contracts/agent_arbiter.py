# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from genlayer import *


# Task lifecycle states.
CREATED = "CREATED"
ASSIGNED = "ASSIGNED"
SUBMITTED = "SUBMITTED"
SETTLED = "SETTLED"
CANCELLED = "CANCELLED"

# Settlement outcomes.
APPROVED = "APPROVED"
REJECTED = "REJECTED"
UNDETERMINED = "UNDETERMINED"


@allow_storage
@dataclass
class Task:
    id: str
    spec: str
    criteria: str
    deadline: str
    amount: u256
    requester: Address
    worker: Address
    status: str
    # Evidence the worker commits to (self-describing, immutable).
    evidence: str
    outcome: str
    reasoning: str


def _parse_dt(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


class AgentArbiter(gl.Contract):
    """Two-sided escrow with AI adjudication for agent-to-agent work.

    The requester deposits the task reward, the worker deposits an equal
    good-faith stake, and after the worker submits evidence a GenLayer
    validator committee judges whether the work satisfies the spec.

    Settlement math:
      - APPROVED     -> worker gets amount + stake, requester gets nothing.
      - REJECTED     -> requester gets amount + stake, worker gets nothing.
      - UNDETERMINED -> both parties get their own deposits back.
    """

    tasks: TreeMap[str, Task]

    def __init__(self):
        pass

    # ------------------------------------------------------------------
    # Deterministic helpers
    # ------------------------------------------------------------------

    def _require_task(self, task_id: str) -> Task:
        task = self.tasks.get(task_id)
        if task is None:
            raise gl.vm.UserError("Task does not exist")
        return task

    def _is_past_deadline(self, deadline: str) -> bool:
        now = datetime.now(timezone.utc)
        return now > _parse_dt(deadline)

    @gl.public.view
    def get_task(self, task_id: str) -> dict:
        t = self._require_task(task_id)
        return {
            "id": t.id,
            "spec": t.spec,
            "criteria": t.criteria,
            "deadline": t.deadline,
            "amount": t.amount,
            "requester": t.requester.as_hex,
            "worker": t.worker.as_hex,
            "status": t.status,
            "evidence": t.evidence,
            "outcome": t.outcome,
            "reasoning": t.reasoning,
        }

    @gl.public.view
    def get_task_ids(self) -> list[str]:
        return list(self.tasks.keys())

    @gl.public.write.payable
    def create_task(
        self, task_id: str, spec: str, criteria: str, deadline: str
    ) -> None:
        if self.tasks.get(task_id) is not None:
            raise gl.vm.UserError("Task already exists")

        amount = gl.message.value
        if amount <= 0:
            raise gl.vm.UserError("Must deposit the task reward")

        if self._is_past_deadline(deadline):
            raise gl.vm.UserError("Deadline must be in the future")

        sender = gl.message.sender_address
        task = Task(
            id=task_id,
            spec=spec,
            criteria=criteria,
            deadline=deadline,
            amount=amount,
            requester=sender,
            worker=Address("0x" + "00" * 20),
            status=CREATED,
            evidence="",
            outcome="",
            reasoning="",
        )
        self.tasks[task_id] = task

    @gl.public.write.payable
    def accept_task(self, task_id: str) -> None:
        task = self._require_task(task_id)
        if task.status != CREATED:
            raise gl.vm.UserError("Task is not open for acceptance")

        if self._is_past_deadline(task.deadline):
            raise gl.vm.UserError("Task deadline has passed")

        stake = gl.message.value
        if stake != task.amount:
            raise gl.vm.UserError("Stake must equal the task reward")

        task.worker = gl.message.sender_address
        task.status = ASSIGNED

    @gl.public.write
    def submit_work(self, task_id: str, evidence: str) -> None:
        task = self._require_task(task_id)
        if task.status != ASSIGNED:
            raise gl.vm.UserError("Task is not in progress")
        if gl.message.sender_address != task.worker:
            raise gl.vm.UserError("Only the worker can submit work")
        if not evidence:
            raise gl.vm.UserError("Evidence must not be empty")

        task.evidence = evidence
        task.status = SUBMITTED

    # ------------------------------------------------------------------
    # Refunds
    # ------------------------------------------------------------------

    @gl.public.write
    def refund_unaccepted(self, task_id: str) -> None:
        """Requester reclaims the reward if nobody accepted before the deadline."""
        task = self._require_task(task_id)
        if task.status != CREATED:
            raise gl.vm.UserError("Task is not unaccepted")
        if gl.message.sender_address != task.requester:
            raise gl.vm.UserError("Only the requester can refund")
        if not self._is_past_deadline(task.deadline):
            raise gl.vm.UserError("Deadline has not passed yet")

        task.status = CANCELLED
        task.outcome = "CANCELLED"
        self._pay(task.requester, task.amount)

    # ------------------------------------------------------------------
    # Non-deterministic adjudication
    # ------------------------------------------------------------------

    def _judge(self, spec: str, criteria: str, evidence: str) -> dict:
        fallback = {"approved": False, "undetermined": True, "reasoning": "adjudication unavailable"}
        try:
            prompt = f"""
You are an impartial adjudicator evaluating whether a completed task
satisfies its written specification and acceptance criteria.

SPECIFICATION:
{spec}

ACCEPTANCE CRITERIA:
{criteria}

SUBMITTED EVIDENCE:
{evidence}

Decide whether the evidence demonstrates that the task was completed
according to the specification and criteria.

Respond in JSON only:
{{
    "approved": bool,
    "undetermined": bool,
    "reasoning": str
}}
Set "approved": true only when the specification and all acceptance
criteria are clearly satisfied by the evidence. Set "undetermined": true
only when the evidence is too incomplete or ambiguous to judge. Otherwise
set both to false.
"""
            result = gl.nondet.exec_prompt(prompt, response_format="json")

            if isinstance(result, dict) and "approved" in result:
                return result
            if isinstance(result, str):
                parsed = json.loads(result)
                if isinstance(parsed, dict) and "approved" in parsed:
                    return parsed
            return fallback
        except Exception:
            return fallback

    @gl.public.write
    def settle(self, task_id: str) -> None:
        task = self._require_task(task_id)
        if task.status != SUBMITTED:
            raise gl.vm.UserError("Task is not submitted")

        spec = task.spec
        criteria = task.criteria
        evidence = task.evidence

        verdict = self._judge(spec, criteria, evidence)

        task.status = SETTLED
        approved = bool(verdict.get("approved", False))
        undetermined = bool(verdict.get("undetermined", False))
        task.reasoning = str(verdict.get("reasoning", ""))

        requester = task.requester
        worker = task.worker
        amount = task.amount

        if undetermined:
            task.outcome = UNDETERMINED
            self._pay(worker, amount)
            self._pay(requester, amount)
        elif approved:
            task.outcome = APPROVED
            self._pay(worker, amount + amount)
        else:
            task.outcome = REJECTED
            self._pay(requester, amount + amount)

    # ------------------------------------------------------------------
    # Fund transfer
    # ------------------------------------------------------------------

    def _pay(self, recipient: Address, value: u256) -> None:
        try:
            gl.get_contract_at(recipient).emit_transfer(value=value)
        except Exception:
            pass  # In simulation / direct mode, transfer may not complete.
