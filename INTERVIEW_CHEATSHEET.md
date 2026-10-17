# AgriGain — Interview Cheat Sheet

> Revise top to bottom the night before. Bold = say it out loud. Every number here is real and
> traceable to the code — if pushed, the full reasoning is in `CODEBASE.md`.

---

## 1. The 30-second pitch

**"AgriGain helps Indian smallholder farmers turn crop residue — rice husks, sugarcane bagasse —
into income instead of burning it. A farmer logs waste in units they actually own, like sacks, and
an AI agent figures out the best use: compost it, sell it raw, or process it. The interesting
engineering is that the LLM never does math and never invents facts — arithmetic is in Python,
prices come from search or curated data, and the model only decides which tools to call and
arranges the evidence."**

Stack: **Next.js 14 + FastAPI + ChromaDB + Gemini + LangGraph + Firestore + Tavily.**

---

## 2. Architecture in one breath

```
Next.js  →  FastAPI  →  LangGraph ReAct loop
                           ├─ calculator   (pure Python, deterministic)
                           ├─ rag          (ChromaDB + Gemini, grounded)
                           └─ web_search   (Tavily + Gemini extraction)
                        →  Response Synthesizer  →  ranked recommendations
```

**"The LLM is the router, not the oracle."** It picks tools; tools produce facts; a final LLM step
arranges facts into advice.

Two generations live side by side:
- **v1** — plain RAG: retrieve → prompt → generate. Still powers the multilingual chat.
- **v2** — agentic ReAct loop. Powers the main recommendations page.

---

## 3. The five design decisions to lead with

### ① "LLMs don't do arithmetic here"
Revenue, ROI, CO₂, biochar yield — all computed in `CalculatorAgent` from JSON constants.
**Why:** an LLM asked for revenue gives a *plausible-looking* wrong number. Code gives the right one.

### ② "Native function calling, not JSON-in-a-prompt"
The old planner asked Gemini to write a JSON plan as text → needed fence-stripping, `json.loads`,
retries, and a fallback plan **that was itself broken** (sent empty input to the calculator).
Switched to Gemini native function calling: schema enforced by the API, **all that parsing code
deleted, not fixed.** *"The most reliable parser is the one you don't write."*

### ③ "The registry IS the schema"
Tool schemas used to be hand-written in the prompt and **drifted** — the LLM literally couldn't
call acreage-based estimation because it wasn't declared. Now `AgentMetadata` generates Gemini
`FunctionDeclaration`s. **One declaration, two consumers, drift impossible.**

### ④ "Single-writer discipline for parallel safety"
Tools can run in parallel and both write state. `chat_history` is written **only** by the agent
node; tools append to a reducer-protected `observations` list, which the agent folds into one turn.
**Concurrency safety by construction, not by locks.**

### ⑤ "Silence beats fabrication"
Every layer degrades gracefully — *except* recommendations. With no evidence, the synthesizer
returns **nothing** rather than inventing. **"For a farmer making a money decision, a confident
wrong number is worse than no number."**

---

## 4. ReAct loop — know this cold

| Concept | Detail |
|---|---|
| Loop shape | `agent → router → tools → back to agent` … `→ synthesizer → END` |
| What makes it ReAct | **The edge from tools back to agent.** Before, it went straight to synthesizer = one-shot fan-out, not ReAct. |
| `MAX_TURNS = 3` | Caps **decision rounds**, not tool calls. One round can request several tools in parallel. |
| Termination — 3 guards | ① turn cap ② `(tool, args)` dedup via SHA-256 of sorted JSON ③ per-agent timeouts |
| Out-of-scope detection | **No tool calls on turn 1** = model judged it irrelevant. Replaced a `"no waste" in msg` substring hack. |
| Errors | Fed **back to the model** as observations → it can retry with valid args. Error messages are part of the control loop. |
| Dedup key | `sort_keys=True` so `{a,b}` and `{b,a}` hash the same — LLM arg order is unstable. |

**Timeouts (and why they nest):**
calculator **5s** · rag **50s** · web_search **30s**.
RAG's inner Gemini timeout is **45s** → outer must be **> 45** or slow-but-good answers get killed.

---

## 5. RAG — numbers and reasons

| Knob | Value | Why |
|---|---|---|
| Embedding model | `all-MiniLM-L6-v2`, 384-dim | Fast on CPU; 53 docs don't need bigger |
| Chunking | **300 words, 50 overlap** | Overlap keeps boundary-spanning ideas intact |
| Query expansion | up to **10 queries** per request | Different phrasings hit different doc types (guides, prices, buyers) |
| Relevance cutoff | cosine distance **> 0.9 dropped** | Real matches sit at 0.2–0.4 |
| Waste-type boost | **−0.15** to distance | Breaks ties; can never let a far match win |
| Confidence | best distance → **0.95 … 0.50**, none → **0.30** | From relevance, not result count |

Structured records (prices, buyers) are rendered **into sentences** before embedding —
*"embedding models are trained on prose, not JSON."*

---

## 6. War stories (STAR-ready — pick 2–3)

### 🔥 The silent embedding mismatch (A1)
- **S:** Retrieval worked — returned docs, no errors — but results were subtly off.
- **T:** Find why.
- **A:** Ingestion embedded docs with SentenceTransformer; queries were embedded by **Chroma's own
  default model** because no embedding function was bound. Two vector spaces.
  Built a shared `embedding.py` bound to the collection on both sides.
- **R:** Distances tightened to **0.21–0.32**, top hits became exact matches.
- **Lesson:** *"The worst bugs don't throw."*

### 🔥 The 1000× price bug (C1)
- Scraped `"₹2500/ton"` was parsed as **₹2500/kg** (real: ₹2.50/kg) — regex took the first number.
- Fixed: unit-aware parsing; **reject** prices without a recognizable unit instead of guessing.
- Added a **0.2×–5× sanity band** vs curated prices (C4).
- *"The bug wasn't parsing — it was guessing."*

### 🔥 Confidence that rewarded garbage (A3)
- Confidence was `0.85 + 0.02 × num_sources`, and retrieval always returned *k* results.
- So **irrelevant queries got maximum confidence.**
- Fixed both: distance cutoff (can now return **zero**) + confidence from **best match distance**.

### 🔥 The security hole that looked secure (D1)
- `firestore.rules` correctly enforced `auth.uid == userId` …
- … but the backend used the **Admin SDK, which bypasses rules entirely**, with `userId` from the
  request body. Anyone could read any farmer's data.
- Fixed: verify Firebase ID token, trust only the token's uid. Gated behind `AUTH_REQUIRED`.

### 🔥 async def that blocked everything (E1)
- Handlers were `async def` with **blocking** Firestore/Gemini calls → froze the event loop;
  a 90s request blocked every user.
- Fixed: plain `def` → FastAPI runs them in a threadpool. Paired with adding timeouts to 4 Gemini
  calls that had none (E2).

---

## 7. Evaluation — the "groundedness" metric

**"The system's core promise is 'never invent buyers, prices, or phone numbers' — and the
evaluator never measured it."**

- Extract checkable claims: prices (regex), phone numbers (regex), buyer names (from the
  structured `Potential Buyers:` field).
- Check each appears **verbatim** in the retrieved context.
- Score = grounded / total.
- **Key design choice:** zero claims = **1.0** ("vacuously grounded"). Declining must not be
  penalized, or you train the system to invent.
- Conservative by design: over-reports invention rather than under-reports.

Golden set: **26 scenarios** in `test_queries.csv`, incl. an adversarial waste type not in the KB.

---

## 8. Production hardening (rattle these off)

| | What | Detail |
|---|---|---|
| **Auth** | Firebase ID token verification | Token uid vs body uid → 401/403 |
| **CORS** | Fixed invalid `*` + credentials combo | Credentials only when origins restricted |
| **Rate limit** | 60/min per IP, sliding window | Cost control — one request ≈ **8 LLM calls** |
| **Prompt injection** | `<search_results>` delimiters + "treat as data" | Web content is attacker-controlled |
| **Info leak** | Generic 500s, real error logged server-side | Removed `str(e)` echoes |
| **Health** | `/health` checks agent registry | Was reporting "healthy" while every agent call failed |

**Prompt temperature ladder** (shows you thought about it):
`0.1` JSON extraction → `0.2` ranking facts → `0.3` grounded generation → `0.4–0.5` open advice.

---

## 9. Likely questions → crisp answers

**Why ReAct instead of just calling all three tools every time?**
> Not every question needs every tool. A pure "how do I compost" needs only RAG. And the loop lets
> the model use one tool's output — like a failed unit conversion — to decide the next call.

**Why LangGraph?**
> Explicit state, reducers for safe parallel writes, conditional edges, and streaming a per-node
> trace — which powers the live "agent reasoning" timeline.

**How do you stop the loop running forever?**
> Three independent guards: turn cap, dedup of identical calls, per-tool timeouts. Any one alone
> isn't enough.

**How do you prevent hallucination?**
> Layered: grounding rules + an explicit "not available" escape hatch in prompts; math in code;
> price sanity bounds; empty output when there's no evidence; and a groundedness metric to measure it.

**Why ChromaDB and not Pinecone/pgvector?**
> 53 documents. Embedded, file-based, zero ops. A managed vector DB would be operational cost for
> no gain at this scale.

**How would you scale it?**
> Redis for the rate limiter (it's per-process today — there's a comment naming that ceiling),
> cache results on `(waste_type, kg, region)`, async Gemini client instead of thread-wrapped
> timeouts, persist runs so follow-up questions work.

**Why `--workers 1 --threads 8` in gunicorn?**
> The process holds a 90 MB embedding model and the rate-limit state. Multiple workers would
> duplicate the model and silently multiply the rate limit. Threads share both.

**What's a weakness?** *(they will ask — own it)*
> Frontend auth is still a placeholder, so the backend auth gate is built but off. And region
> isn't persisted yet, so region-aware logic exists but always sees "all". Both are known, ranked,
> and next on the list.

---

## 10. Testing philosophy (one line that lands)

**"Every non-obvious fix leaves behind one runnable check that fails if it regresses."**
Four offline self-checks — no network, no API keys — because Gemini's free tier (~20 req/day)
made live tests unreliable: *you can't tell a real failure from a quota failure.*

---

## 11. Numbers to have ready

| | |
|---|---|
| Backend / frontend source | ~6,250 Python / ~4,100 TS lines |
| Knowledge base | 5 JSON files → **53** embedded docs |
| Unit conversions | **20** (5 waste types × 4 units) |
| Agents | **3** · max turns **3** |
| LLM calls per recommendation | up to **~8** |
| Frontend timeout for recommendations | **90s** (vs 60s default) |
| Golden-set scenarios | **26** |
| Languages | UI: **2** (en/hi) · AI chat: **10** Indian languages |

---

## 12. If you only remember three lines

1. **"The LLM routes; code computes; evidence grounds."**
2. **"A system that says 'I don't know' beats one that guesses confidently."**
3. **"The worst bugs I fixed didn't throw errors — they returned plausible wrong answers."**

---

### ⚠️ Don't get caught out

Know these exist — if the interviewer clones the repo, mention them first:
- ~63% of UI waste/unit combos 400 (frontend offers options backend doesn't support).
- Dashboard is demo data; guide "Read more" links 404.
- `/ai_insight` didn't get the confidence fix — still count-based.

**Framing:** *"I triaged these into a ranked list — they're product gaps, not architecture
problems."* Raising them yourself reads as ownership; being caught reads as not knowing your code.
