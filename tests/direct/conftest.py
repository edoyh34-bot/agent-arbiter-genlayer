"""Shared helpers for direct mode tests."""


def to_hex(addr):
    """Convert an address object to its EIP-55 checksummed hex string."""
    if hasattr(addr, "as_hex"):
        return addr.as_hex
    from genlayer.py.types import Address

    return Address(addr).as_hex
