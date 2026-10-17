# AgriGain — The Overseer's Training Guide

> `CODEBASE.md` is the encyclopedia. `INTERVIEW_CHEATSHEET.md` is the pitch.
> **This is the gym.** It turns "I've read about it" into "I can predict what the code does, explain
> why, and spot when a change breaks it." That's what separates an overseer from a novice: a novice
> knows what the code *says*; an overseer knows what it *does*, what it *protects*, and what *breaks*
> when someone touches it.

**How to use it — three passes:**
1. **Map** (§1–2): learn the 10 mental models and the invariants. Read each linked line in the IDE.
2. **Trace** (§3–4): walk the requests on paper, then through the code, until you can do it from memory.
3. **Drill** (§5–7): break things on purpose, answer the self-test without looking, practice the
   interviewer's drill-down ladder out loud.

You're ready when you can answer every §6 question in under 30 seconds, naming the file.

---

## 1. The 10 mental models

Each one is the concept, plus **the one line of code that proves it**. Open that line. Explain it
aloud.

| # | Model | Proof line |
|---|---|---|
| 1 | **The LLM routes; code computes.** Gemini picks tools. It never does arithmetic. | `estimated_revenue = estimated_waste_kg * avg_price` — [calculator_agent.py:167](backend/agents/calculator_agent.py:167) |
| 2 | **ReAct = the loop edge back to the agent.** Without it, it's a one-shot fan-out. | `workflow.add_edge("calculator", "agent")` — [graph.py:144](backend/orchestrator/graph.py:144) |
| 3 | **One writer per ordered structure.** Tools never touch `chat_history`; they append observations the agent folds in. | `chat_history: List[...]` (no reducer) vs `observations_this_turn: Annotated[..., merge_lists]` — [state.py:22-26](backend/orchestrator/state.py:22) |
| 4 | **The registry is the schema.** What Gemini can call is generated, not hand-written. | `to_function_declarations()` — [tool_registry.py:53](backend/registry/tool_registry.py:53) |
| 5 | **Same embedder on both sides, or retrieval silently rots.** | `get_collection(..., embedding_function=app_state.embedding_model)` — [main.py:175](backend/main.py:175) |
| 6 | **Relevance, not count.** Far documents are dropped; confidence comes from the best match. | `if distance > self.MAX_RELEVANT_DISTANCE: continue` — [rag_service.py:158](backend/rag_service.py:158) |
| 7 | **Errors are observations.** A failed tool's message goes back to the model so it can retry. | `return {"error": response.error.message ...}` — [executor.py:29](backend/orchestrator/executor.py:29) |
| 8 | **Timeouts nest.** Outer must exceed inner, or good-but-slow answers die. | rag `timeout_seconds=50` [main.py:334](backend/main.py:334) > internal `45` [rag_service.py:292](backend/rag_service.py:292) |
| 9 | **Sync work belongs in `def`, not `async def`.** FastAPI threads `def` handlers; `async def` with blocking calls freezes the event loop. | `def log_waste(` — [main.py:556](backend/main.py:556) |
| 10 | **Silence beats fabrication.** No evidence → no recommendation. | `if not any(evidence[k] ...): return None` — [response_synthesizer.py:70](backend/agents/response_synthesizer.py:70) |

If an interviewer asks a question you don't know, one of these 10 almost always contains the answer.
Reason from the model, not from memory.

---

## 2. The invariants — what must never break

An overseer's real job is guarding these. Every AI-written change you review, check it against this
list. Each one is a past bug, so breaking it brings that bug back.

| Invariant | Where it lives | Break it and you get… |
|---|---|---|
| Ingest and query use the **same** embedding function | `embedding.py`, [main.py:175](backend/main.py:175), [ingest.py:64](backend/ingest.py:64) | **A1**: plausible but wrong retrieval, zero errors |
| `initialize_ml_models()` runs **before** `initialize_chroma()` | [main.py:240-248](backend/main.py:240) | Collection bound to `None` → Chroma's default embedder → A1 again |
| Agent outer timeout **>** its internal LLM timeout | [main.py:311-350](backend/main.py:311) | Spurious `TIMEOUT` on successful calls |
| Only `agent_node` writes `chat_history` | [graph.py:31-52](backend/orchestrator/graph.py:31) | Malformed/interleaved Gemini history under parallel tools |
| `agent_node` returns only the **new** `called_tools` keys | [graph.py:77](backend/orchestrator/graph.py:77) | Reducer concatenates → duplicated keys every turn |
| `_LIST_MERGE_KEYS` / `_DICT_MERGE_KEYS` mirror `state.py` reducers | [graph.py:156-157](backend/orchestrator/graph.py:156) | Streamed final state silently overwrites instead of merging |
| `waste_type` normalized to `snake_case` before KB lookup | [rag_agent.py:59](backend/agents/rag_agent.py:59) | Metadata match never fires → 0 waste-specific hits |
| Price parsing **rejects** unitless prices | [response_synthesizer.py:36](backend/agents/response_synthesizer.py:36) | **C1**: 1000× revenue errors |
| Scraped price within **0.2×–5×** of curated | [response_synthesizer.py:270](backend/agents/response_synthesizer.py:270) | Poisoned web data overrides real numbers |
| Waste-type boost ≪ typical distance spread (0.15) | [rag_service.py:115](backend/rag_service.py:115) | **A4**: keyword match beats semantic match |
| Uid trusted **only** from the verified token | [main.py:455](backend/main.py:455) | **D1**: anyone reads anyone's data |
| Credentials only with explicit CORS origins | [main.py:379](backend/main.py:379) | Browsers reject every credentialed call |
| Blocking handlers are `def` | all route handlers | **E1**: one slow request freezes the server |
| Every Gemini call is time-bounded | 7 `ThreadPoolExecutor` sites | **E2**: a hung call pins a worker forever |

**Memorize the left column.** In an interview, "what are the invariants of your system?" is a
senior-level question. Most candidates can't answer it.

---

## 3. Trace drills — walk these until automatic

Close the code. Write each step on paper. Then open the code and check. Repeat until you get it
perfect twice in a row.

### Drill A — "I log 10 sacks of rice"

```
1. waste-logger-form.tsx    mapWasteType("rice") → "rice_husks"            api.ts:408
2.                          userId = `user_${Date.now()}`  ← NEW USER EVERY TIME   :142
3. POST /log_waste
4. main.py rate_limit_middleware  → bucket for IP, under 60/min → pass    main.py:404
5. log_waste()  authorize_for_user → no-op (AUTH_REQUIRED=false)          :571
6.              key "rice_husks_sacks" → factor 25.0                       :578
7.              estimated_kg = round(10 × 25.0, 2) = 250.0                 :589
8.              uuid4 → Firestore artifacts/agri_gain_v1/users/{uid}/waste_logs/{id}
9. Frontend waits 3s → window.location to /opportunities?wasteLogId=…&userId=…
```

**Branches to know:**
- "Corn" + "sacks" → `corn_stalks_sacks` not in models → **400** (the 63% bug).
- No Firebase → still returns 250.0, but nothing persisted → next step 404s.
- `quantity=0` → **422** before the handler runs (`ge=1` on the Pydantic model).

### Drill B — "Get recommendations" (the agentic path)

```
1. opportunities/page.tsx → api.getOpportunities() → POST /api/v2/recommend  (90s timeout)
2. recommend(): read waste log; read profile/main → doesn't exist → region = "all"
3. query = "I have 250.0 kg of rice husks in all. What is the best option for maximum profit?"
4. run_orchestrator → compiled_graph.stream(...)
   TURN 1  agent_node: seed user turn → ReactAgent.decide()
           Gemini (tools bound) → function_call rag(waste_type="rice husks", total_kg=250)
           dedupe via call_key → accepted
           router_edge → ["rag"] → rag_node
           RAGAgent: "rice husks" → "rice_husks"; RAGService pipeline; confidence from best distance
           → observations_this_turn += [rag result] → edge back to agent
   TURN 2  agent_node: folds 1 new observation into ONE function-response turn
           decide() → calculator(...)   → calculator_node → back to agent
   TURN 3  decide() → web_search(...)   → web_search_node → back to agent
   TURN 4  decide(): turn > MAX_TURNS → finish_reason "turn_cap", no API call
           router_edge: no pending_calls → ["synthesizer"]
5. synthesizer_node → price conflict resolution (C1/C4) → 2 LLM synthesis calls → END
6. recommend() bolts on legacy fields: opportunities_text, structured_opportunities
   (categorize_recommendations keyword buckets), sources_used, etc.
```

**Count the LLM calls:** 3 decide + 1 RAG generate + 1 web extraction + 2 synthesis = **7**
(+1 more decide if the model stops early with `model_done` instead of hitting the cap). That's
why rate limiting is a *cost* control.

**Branches to know:**
- Gemini returns text on turn 1 → `out_of_scope`, no tools, empty evidence → synthesizer returns
  no LLM recs.
- Calculator fails (bad unit) → error goes back as observation → model may retry with valid args
  next turn.
- Same call twice → skipped; if *all* calls skipped → `no_new_calls`, stop.

### Drill C — "Ask the chat in Tamil"

```
1. ai-insight.tsx → POST /ai_insight {language:"tamil"}
2. language in whitelist → "Tamil (தமிழ்)" injected into prompt
3. Queries ChromaDB DIRECTLY (not RAGService) → no distance filter
4. confidence = min(1.0, 5 × 0.2) = 1.0     ← the A3 bug, never back-ported here
5. Grounded prompt → answer; if < 50 chars → fallback prompt, confidence 0.7, fallback_used=true
```

**Why this drill matters:** it's the clearest example of *a fix applied in one path and not
another*. Spotting that kind of inconsistency is exactly the overseer skill.

---

## 4. Change-impact map — "if I touch X, what else moves?"

AI assistants change one file and forget the coupled ones. This table is your review checklist.

| You change… | You must also check… |
|---|---|
| A waste type or unit | `quantification_models.json`, `WASTE_TYPE_MAPPING` (api.ts), icons + defaults in `waste-logger-form.tsx`, `ai-insight.tsx` list, translations, re-run `ingest.py` |
| Any embedded JSON (`how_to_guides`, `market_data`, `buyer_directory`, `safety_sheets`) | Re-run `ingest.py` — the store is not watched |
| The embedding model | Re-ingest everything (or A1 returns) |
| The three-bucket taxonomy | 8 places — see `CODEBASE.md` §5.5 |
| RAG prompt output format | `structure_opportunities_text`, `parseStructuredOpportunities`, evaluator's `Potential Buyers:` regex |
| Error strings in `rag_service.py` | `isAiErrorText()` in `opportunities/page.tsx` string-matches them |
| A state field with a reducer | `_LIST_MERGE_KEYS` / `_DICT_MERGE_KEYS` in `graph.py` |
| Add an agent | `main.py` registration, `executor.py` node, `graph.py` node + edges, `/health` expected set |
| An agent's internal timeout | Its registry `timeout_seconds` |
| `MAX_TURNS` | `recursion_limit: 25` headroom in `graph.py` |
| Turn on `AUTH_REQUIRED` | Frontend must first send Firebase tokens, or everything 401s |
| Gunicorn to >1 worker | Rate limiter becomes per-worker (move to Redis) |

---

## 5. Break-it-on-purpose exercises

The fastest way to own code is to break it and watch the symptom. Do these on a throwaway branch.

```bash
git switch -c drills        # revert everything after with: git switch - && git branch -D drills
```

**Offline — no API key, no quota cost:**

| # | Break | Run | You should see |
|---|---|---|---|
| 1 | In `_extract_price_value`, return the first number found regardless of unit | `python backend/test_price_parse.py` | `₹2500/ton` → 2500, assertion fails. **That's C1.** |
| 2 | Set `WASTE_TYPE_MATCH_BOOST = 2.0` | `python backend/test_retrieval_ranking.py` | Far keyword match ranks first. **That's A4.** |
| 3 | Set `MAX_RELEVANT_DISTANCE = 5.0` | same | Out-of-domain query no longer returns zero. **That's A3.** |
| 4 | Remove `sort_keys=True` in `call_key` | `python backend/test_react_loop.py` | Order-independence assertion fails. |
| 5 | In `check_groundedness`, make the zero-claims case return `groundedness_score: 0.0` | `python backend/test_groundedness.py` | A correct decline gets penalized. Explain why that's dangerous. |

**Live — costs Gemini quota (~7 calls each), do sparingly:**

| # | Break | Observe via | You should see |
|---|---|---|---|
| 6 | `MAX_TURNS = 1` | `POST /investigations` with "I have 500kg rice husks in Punjab, best profit?" | Only one tool runs; other two show `skipped`. |
| 7 | rag `timeout_seconds=10` in `main.py` | same | `rag finished` → `unavailable`, `TIMEOUT` error. Nested-timeout invariant, live. |
| 8 | Point the 3 tool edges at `"synthesizer"` instead of `"agent"` | same | Trace shows one agent turn only — it's a fan-out now, not ReAct. |

For each one, write one sentence: *"This line exists because without it, ___."* That sentence is
your interview answer.

---

## 6. Self-test — answer before looking

Answer each question out loud and name the file. Aim for under 30 seconds each.
Only then scroll down to the answer key.

### Questions

1. Why is there a `sys.path.insert` at the top of main.py?
2. What happens if `initialize_chroma()` runs before `initialize_ml_models()`?
3. Why does the rag agent have a 50s timeout but the calculator 5s?
4. MAX_TURNS=3 — 3 tool calls or 3 rounds?
5. How does the system know a query is out of scope?
6. Why does `call_key` use `sort_keys=True`?
7. Why can't tool nodes write `chat_history` directly?
8. Why is a failed tool's error sent back to the model?
9. Why native function calling instead of asking for JSON?
10. Where does the tool schema Gemini sees come from?
11. Why is the waste-type boost 0.15 and not larger?
12. Why does RAG generate ~10 queries instead of one?
13. Why are price and buyer records turned into sentences before embedding?
14. Why chunk with 50 words of overlap?
15. Why are route handlers `def` not `async def`?
16. How do you put a timeout on `generate_content()`?
17. The firestore.rules look correct. Why was data still exposed?
18. Why is `AUTH_REQUIRED` off by default?
19. Why sliding window rate limiting, and why exempt /health?
20. What's the 0.2×–5× band?
21. Why does zero claims score 1.0 groundedness?
22. Why is region always "all"?
23. Why do 63% of UI combinations fail?
24. Why does the frontend call /api/v2/recommend from `getOpportunities()`?
25. Why `--workers 1 --threads 8`?

---

### Answer key

> Stop. Answer all 25 first.

**1.** Code imports itself two ways — flat (`from quantify import`) and package (`from backend.agents…`). The package form needs the repo root on the path, but uvicorn runs from `backend/`. The shim adds the parent dir. main.py:16-21.

**2.** `embedding_model` is still `None`, so the collection binds no embedder and Chroma uses its default for queries — the A1 vector-space mismatch, silently.

**3.** Calculator is local arithmetic. RAG makes a ChromaDB query plus a Gemini call whose own timeout is 45s; the outer must exceed the inner or slow-but-successful calls get thrown away.

**4.** 3 decision rounds. A round can request several tools in parallel. It matches 3 tools only because Gemini empirically requests one per turn here.

**5.** The model makes no tool calls on turn 1. Same signal on turn 2+ means "done". react_agent.py:101. Replaced a `"no waste" in message` substring check.

**6.** LLM-generated arg dicts have unstable key order; without sorting, identical calls hash differently and dedup fails.

**7.** Parallel tools would append interleaved turns; Gemini needs function responses grouped in one turn matching the call turn. Tools append to a reducer-safe list; the agent folds them in.

**8.** So the model can adapt — retry with valid args or move on. quantify.py's error lists valid combinations precisely so the model can fix its next call.

**9.** The API enforces the schema. The old approach needed fence-stripping, parsing, retries and a fallback plan that was itself broken. All deleted.

**10.** `AgentMetadata.parameters/required` in `initialize_agent_registry()` → `ToolRegistry.to_function_declarations()`. Single source of truth (B3).

**11.** It must break near-ties but never let a distant match beat a close one. Real matches sit at 0.2–0.4 distance; 0.15 can't bridge a 0.85-vs-0.10 gap.

**12.** Query expansion. The KB holds guides, prices, buyers and safety sheets in different vector-space regions; differently-phrased queries probe each.

**13.** Embedding models are trained on prose; a sentence lands near natural-language queries, raw JSON doesn't.

**14.** So an idea spanning a chunk boundary appears whole in at least one chunk.

**15.** Bodies are blocking (Firestore, Gemini). `async def` would run them on the event loop and freeze all requests; `def` runs them in FastAPI's threadpool (E1).

**16.** It has no timeout param. Submit it to a single-worker ThreadPoolExecutor and `future.result(timeout=N)`. Caveat: the thread keeps running; you only stop waiting.

**17.** The backend uses the Admin SDK, which bypasses rules, with `userId` from the body. Fix: trust only the verified token's uid (D1).

**18.** The frontend sends no tokens (`userId = user_${Date.now()}`). Turning it on breaks the app until frontend auth exists.

**19.** Fixed windows allow 2× bursts at boundaries. /health exempt so monitors don't report "down" under load. It's a cost control: ~7 LLM calls per recommendation.

**20.** A scraped price must be within that ratio of the curated implied price, or it's rejected (C4). Wide enough for real market moves, narrow enough to catch unit errors and injection.

**21.** A response that correctly declines invented nothing. Scoring it 0 would reward inventing.

**22.** `profile/main` is read but never written anywhere, so the lookup always misses.

**23.** The form merges backend options with hardcoded defaults instead of replacing them, so it offers corn/wheat/bags/trucks the backend has no conversion for → 400.

**24.** v2 replaced v1 but the method name wasn't changed. `/get_opportunities` is dead code. It also bypasses `request()` to get a 90s timeout and no retries.

**25.** Per-process state: the 90 MB embedding model and the in-memory rate limiter. More workers duplicate the model and multiply the effective rate limit.

**Scoring:** 22+ → ready. 15–21 → redo §3 traces. Under 15 → redo §1 and §2 with the code open.

---

## 7. The interviewer's drill-down ladder

Interviewers go four levels deep. Novices stop at L1. Practice reaching L4 on every component.

| Level | Question shape | Example (RAG retrieval) |
|---|---|---|
| **L1 — What** | "What does it do?" | Retrieves relevant knowledge-base docs for a waste type. |
| **L2 — How** | "Walk me through it." | 10 expanded queries → Chroma → dedupe → drop distance > 0.9 → rank by distance minus 0.15 boost → top 12. |
| **L3 — Why** | "Why that, not X?" | Single sorted list instead of buckets, because bucketing let a 1.9-distance keyword match beat a 0.3 semantic match. |
| **L4 — What if / trade-off** | "What breaks? What would you change?" | First-wins dedupe ranks a doc by whichever query found it first, not its best score. I'd keep the min distance per doc. |

Fill the L4 column yourself for each — these are your strongest answers:

| Component | L4 answer to have ready |
|---|---|
| ReAct loop | Agent is rebuilt every turn, so the "cached" tool model rebuilds 3×. I'd hold one `ReactAgent` per run. |
| Registry | Routing is dynamic but graph nodes are still hardcoded — the registry fills during `lifespan`, after graph import. |
| Confidence | Overall confidence is a plain mean; a perfect calculator hides a weak RAG result. I'd weight by tool relevance. |
| Timeouts | Thread-wrapped timeouts stop waiting but don't free the thread. Real fix: async Gemini client. |
| Rate limiter | Per-process, unbounded key growth. Redis with TTL for multi-worker. |
| `/ai_insight` | Never got the A3 fix; should route through `RAGService.query_vector_database`. |
| Error handling | Errors are strings in the answer field, so the frontend string-matches them. I'd add a `status` field. |

---

## 8. How to review AI-written code on this project

When the AI hands you a diff, run this checklist. This is what "overseer" means in practice.

1. **Does it touch an invariant from §2?** If yes, read that change line by line.
2. **Did it update every coupled place from §4?** AI agents usually change one file.
3. **Did it add a default that hides missing data?** (`or 100.0`, `or 5.0`, `except: pass`) —
   this codebase spent a whole review phase (C2/C3) removing exactly that.
4. **Did it add a blocking call without a timeout, or an `async def` around sync code?** (E1/E2)
5. **Does an error surface as a string where a status should be?** Then something downstream is
   string-matching it.
6. **Did it leave a runnable check?** Every non-obvious fix here ships with a `demo()` self-check.
   No check, not done.
7. **Can you state in one sentence why each new line exists?** If not, ask the AI, or delete it.

That last one is the whole job. Do it for every diff and in a month you'll know this codebase
better than the code that wrote it.
