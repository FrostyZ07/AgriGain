#!/usr/bin/env python3
"""
Self-check for the ReAct loop mechanics (react_agent.py, router.py) - no live
Gemini API calls, so it isn't subject to quota/network. Live end-to-end behavior
(the full graph against the real API) was verified manually; see the plan notes.

Run directly: python test_react_loop.py
"""
import os
import sys
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.orchestrator.react_agent import ReactAgent, call_key, MAX_TURNS
from backend.orchestrator.router import router_edge
from backend.registry.tool_registry import ToolRegistry


class FakeFunctionCall:
    def __init__(self, name, args):
        self.name = name
        self.args = args


class FakePart:
    def __init__(self, function_call=None, text=None):
        self.function_call = function_call
        self.text = text


class FakeModel:
    """Stands in for a genai.GenerativeModel: `script` is one list of
    (tool_name, args) tuples per turn; an empty list means "finish, no more calls"."""

    def __init__(self, script):
        self.script = script
        self.call_count = 0
        self.model_name = "models/fake"

    def generate_content(self, contents, **kwargs):
        calls = self.script[self.call_count] if self.call_count < len(self.script) else []
        self.call_count += 1
        if calls:
            parts = [FakePart(function_call=FakeFunctionCall(name, args)) for name, args in calls]
        else:
            parts = [FakePart(text="done")]
        return SimpleNamespace(candidates=[SimpleNamespace(content=SimpleNamespace(parts=parts))])


def _decide_with_script(script, turn):
    """Run ReactAgent.decide() against a scripted fake model, bypassing the real
    genai.GenerativeModel construction that _model_for_react() would otherwise do."""
    fake = FakeModel(script)
    agent = ReactAgent(gemini_model=fake)
    with patch("google.generativeai.GenerativeModel", return_value=fake):
        return agent.decide(chat_history=[{"role": "user", "parts": [{"text": "hi"}]}], turn=turn)


def demo():
    # 1. call_key is deterministic regardless of dict key order.
    k1 = call_key("calculator", {"waste_type": "rice_husks", "quantity": 3})
    k2 = call_key("calculator", {"quantity": 3, "waste_type": "rice_husks"})
    assert k1 == k2, "call_key should be order-independent"
    k3 = call_key("calculator", {"waste_type": "rice_husks", "quantity": 4})
    assert k1 != k3, "different args must produce a different key"

    # 2. A normal turn: the model requests one tool call.
    decision = _decide_with_script([[("rag", {"waste_type": "rice_husks"})]], turn=1)
    assert decision["finish_reason"] is None
    assert decision["pending_calls"] == [{"tool": "rag", "args": {"waste_type": "rice_husks"}}]

    # 3. The model stops calling tools on a later turn -> model_done.
    decision = _decide_with_script([[]], turn=2)
    assert decision["finish_reason"] == "model_done"
    assert decision["pending_calls"] == []

    # 4. No tool calls on turn 1 -> out_of_scope (replaces the old "no waste" in
    #    message.lower() substring check).
    decision = _decide_with_script([[]], turn=1)
    assert decision["finish_reason"] == "out_of_scope"

    # 5. Turn cap: decide() must refuse to call the model at all once turn > MAX_TURNS.
    fake = FakeModel([[("calculator", {})]])
    agent = ReactAgent(gemini_model=fake)
    decision = agent.decide(chat_history=[], turn=MAX_TURNS + 1)
    assert decision["finish_reason"] == "turn_cap"
    assert fake.call_count == 0, "must not call the model once the turn cap is exceeded"

    # 6. router_edge only routes to tools actually present in the registry
    #    (B6: replaces the old hardcoded ["calculator","rag","web_search"] literal).
    import backend.orchestrator.router as router_module
    empty_registry = ToolRegistry()
    with patch.object(router_module, "global_registry", empty_registry):
        assert router_edge({"pending_calls": [{"tool": "calculator", "args": {}}]}) == ["synthesizer"]
        assert router_edge({"pending_calls": []}) == ["synthesizer"]

    print("All ReAct loop checks passed.")


if __name__ == "__main__":
    demo()
