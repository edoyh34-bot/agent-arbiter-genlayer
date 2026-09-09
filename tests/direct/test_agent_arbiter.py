"""Direct-mode tests for the AgentArbiter escrow contract."""

import json

from tests.direct.conftest import to_hex

FUTURE = "2099-12-31T00:00:00Z"


def _judge_mock(vm, approved=False, undetermined=False):
    vm.mock_llm(
        r".*impartial adjudicator.*",
        json.dumps(
            {
                "approved": approved,
                "undetermined": undetermined,
                "reasoning": "mock verdict",
            }
        ),
    )


# ----------------------------------------------------------------------
# create_task
# ----------------------------------------------------------------------


def test_create_task_requires_deposit(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/agent_arbiter.py")
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("Must deposit the task reward"):
        contract.create_task("t1", "build an API", "returns 200", FUTURE)


def test_create_task(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/agent_arbiter.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100

    contract.create_task("t1", "build an API", "returns 200", FUTURE)

    task = contract.get_task("t1")
    alice = to_hex(direct_alice)
    assert task["id"] == "t1"
    assert task["amount"] == 100
    assert task["requester"] == alice
    assert task["status"] == "CREATED"
    assert task["worker"] == "0x" + "00" * 20
    assert task["outcome"] == ""


def test_create_task_rejects_past_deadline(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/agent_arbiter.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100

    with direct_vm.expect_revert("Deadline must be in the future"):
        contract.create_task("t1", "spec", "criteria", "2000-01-01T00:00:00Z")


def test_create_task_rejects_duplicate(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/agent_arbiter.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    contract.create_task("t1", "spec", "criteria", FUTURE)

    with direct_vm.expect_revert("Task already exists"):
        contract.create_task("t1", "spec", "criteria", FUTURE)


# ----------------------------------------------------------------------
# accept_task
# ----------------------------------------------------------------------


def test_accept_task_requires_matching_stake(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/agent_arbiter.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    contract.create_task("t1", "spec", "criteria", FUTURE)

    direct_vm.sender = direct_bob
    direct_vm.value = 50
    with direct_vm.expect_revert("Stake must equal the task reward"):
        contract.accept_task("t1")


def test_accept_task(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/agent_arbiter.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    contract.create_task("t1", "spec", "criteria", FUTURE)

    direct_vm.sender = direct_bob
    direct_vm.value = 100
    contract.accept_task("t1")

    task = contract.get_task("t1")
    assert task["status"] == "ASSIGNED"
    assert task["worker"] == to_hex(direct_bob)


def test_accept_task_rejects_after_deadline(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/agent_arbiter.py")

    direct_vm.warp("2026-01-01T00:00:00Z")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    contract.create_task("t1", "spec", "criteria", "2026-01-02T00:00:00Z")

    # Time passes beyond the deadline while the task is still unaccepted.
    direct_vm.warp("2026-01-03T00:00:00Z")
    direct_vm.sender = direct_bob
    direct_vm.value = 100
    with direct_vm.expect_revert("Task deadline has passed"):
        contract.accept_task("t1")# ----------------------------------------------------------------------
# submit_work
# ----------------------------------------------------------------------


def test_submit_work_only_worker(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = direct_deploy("contracts/agent_arbiter.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    contract.create_task("t1", "spec", "criteria", FUTURE)

    direct_vm.sender = direct_bob
    direct_vm.value = 100
    contract.accept_task("t1")

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only the worker can submit work"):
        contract.submit_work("t1", "done")


def test_submit_work(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/agent_arbiter.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    contract.create_task("t1", "spec", "criteria", FUTURE)

    direct_vm.sender = direct_bob
    direct_vm.value = 100
    contract.accept_task("t1")
    contract.submit_work("t1", "https://github.com/worker/task")

    task = contract.get_task("t1")
    assert task["status"] == "SUBMITTED"
    assert task["evidence"] == "https://github.com/worker/task"


# ----------------------------------------------------------------------
# refund_unaccepted
# ----------------------------------------------------------------------


def test_refund_unaccepted(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/agent_arbiter.py")

    direct_vm.warp("2026-01-01T00:00:00Z")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    contract.create_task("t1", "spec", "criteria", "2026-01-02T00:00:00Z")

    # Deadline passes with no worker accepting.
    direct_vm.warp("2026-01-03T00:00:00Z")
    contract.refund_unaccepted("t1")

    task = contract.get_task("t1")
    assert task["status"] == "CANCELLED"


def test_refund_unaccepted_before_deadline_fails(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/agent_arbiter.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    contract.create_task("t1", "spec", "criteria", FUTURE)

    with direct_vm.expect_revert("Deadline has not passed yet"):
        contract.refund_unaccepted("t1")


def test_refund_unaccepted_wrong_caller_fails(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/agent_arbiter.py")

    direct_vm.warp("2026-01-01T00:00:00Z")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    contract.create_task("t1", "spec", "criteria", "2026-01-02T00:00:00Z")

    direct_vm.warp("2026-01-03T00:00:00Z")
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only the requester can refund"):
        contract.refund_unaccepted("t1")


# ----------------------------------------------------------------------
# settle (approved / rejected / undetermined)
# ----------------------------------------------------------------------


def test_settle_approves(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/agent_arbiter.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    contract.create_task("t1", "spec", "criteria", FUTURE)

    direct_vm.sender = direct_bob
    direct_vm.value = 100
    contract.accept_task("t1")
    contract.submit_work("t1", "evidence")

    _judge_mock(direct_vm, approved=True)
    contract.settle("t1")

    task = contract.get_task("t1")
    assert task["status"] == "SETTLED"
    assert task["outcome"] == "APPROVED"


def test_settle_rejects(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/agent_arbiter.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    contract.create_task("t1", "spec", "criteria", FUTURE)

    direct_vm.sender = direct_bob
    direct_vm.value = 100
    contract.accept_task("t1")
    contract.submit_work("t1", "evidence")

    _judge_mock(direct_vm, approved=False)
    contract.settle("t1")

    task = contract.get_task("t1")
    assert task["status"] == "SETTLED"
    assert task["outcome"] == "REJECTED"


def test_settle_undetermined(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/agent_arbiter.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    contract.create_task("t1", "spec", "criteria", FUTURE)

    direct_vm.sender = direct_bob
    direct_vm.value = 100
    contract.accept_task("t1")
    contract.submit_work("t1", "evidence")

    _judge_mock(direct_vm, undetermined=True)
    contract.settle("t1")

    task = contract.get_task("t1")
    assert task["status"] == "SETTLED"
    assert task["outcome"] == "UNDETERMINED"


def test_settle_requires_submitted(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/agent_arbiter.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    contract.create_task("t1", "spec", "criteria", FUTURE)

    with direct_vm.expect_revert("Task is not submitted"):
        contract.settle("t1")


# ----------------------------------------------------------------------
# views
# ----------------------------------------------------------------------


def test_get_task_ids(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/agent_arbiter.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 100
    contract.create_task("t1", "spec", "criteria", FUTURE)
    contract.create_task("t2", "spec", "criteria", FUTURE)

    assert sorted(contract.get_task_ids()) == ["t1", "t2"]


def test_get_task_missing(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/agent_arbiter.py")
    with direct_vm.expect_revert("Task does not exist"):
        contract.get_task("nope")
