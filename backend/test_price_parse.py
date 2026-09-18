#!/usr/bin/env python3
"""
Self-check for ResponseSynthesizer._extract_price_value (C1 fix).

Run directly: python test_price_parse.py
"""
import os
import sys

# agents/response_synthesizer.py imports via the `backend.` package path (see
# main.py's own sys.path shim) - mirror it here so this file runs standalone.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.response_synthesizer import ResponseSynthesizer


def demo():
    s = ResponseSynthesizer()

    cases = [
        ("₹9.4/kg", 9.4),
        ("₹2500/ton", 2.5),
        ("₹2500/tonne", 2.5),
        ("12 per quintal", 0.12),
        ("₹9.4 per kg", 9.4),
    ]
    for price_str, expected in cases:
        got = s._extract_price_value(price_str)
        assert got is not None, f"{price_str!r} -> expected {expected}, got None"
        assert abs(got - expected) < 1e-6, f"{price_str!r} -> expected {expected}, got {got}"

    # No recognizable unit -> must be rejected, not silently treated as per-kg.
    for ambiguous in ["2500", "₹2500", "roughly nine rupees"]:
        assert s._extract_price_value(ambiguous) is None, f"{ambiguous!r} should have been rejected"

    print("All price parsing checks passed.")


if __name__ == "__main__":
    demo()
