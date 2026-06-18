# langgraph-learn

A personal exploration project for learning LangGraph, built independently from a separate Genkit project completed the same week. This project tests LangGraph's graph/node/edge model using both Google Gemini and a local Ollama model (`llama3.2`), including tool calling, multi-provider routing, and a scoped-down multi-step research pipeline with conditional loops.

This project is intentionally separate from the CrewAI/MCP capstone architecture and the Genkit project — no shared code, no integration attempted between frameworks.

## Setup

### Prerequisites
- Node.js v20 or later (tested on v24.16.0)
- npm (tested on 11.13.0)
- [Ollama](https://ollama.com) installed locally, with a model pulled (this project uses `llama3.2`)
- A Google Gemini API key (free tier available at [aistudio.google.com](https://aistudio.google.com/api-keys))

### Install

```bash
npm install
```

If setting up from scratch rather than cloning an existing `node_modules`:

```bash
npm init -y
npm pkg set type=module
npm install -D typescript tsx @types/node
npm install langchain @langchain/core @langchain/langgraph @langchain/google-genai @langchain/ollama
npm install dotenv
```

### Environment variables

Create a `.env` file in the project root:

```
GOOGLE_API_KEY=your_gemini_api_key_here
```

**Note:** LangChain's Gemini integration expects `GOOGLE_API_KEY`, not `GEMINI_API_KEY` — a different convention from Genkit's Google AI plugin. Don't assume these are interchangeable across projects even though they point at the same underlying key.

`.env` is excluded via `.gitignore` and should never be committed.

### Ollama

Confirm Ollama is running and the model is available before running any script that uses it:

```bash
ollama list
```

If `llama3.2` isn't listed:

```bash
ollama pull llama3.2
```

Ollama typically runs as a background service after install. If `ollama list` fails to connect, start it manually with `ollama serve` in a separate terminal.

## Running the scripts

Each script is a standalone entry point — run with `tsx`, no build step needed.

```bash
npx tsx index.ts                      # minimal single-node graph (Gemini)
npx tsx agent-gemini.ts                # tool-calling agent, Gemini only
npx tsx agent-ollama.ts                # tool-calling agent, Ollama only
npx tsx agent-geminiollama.ts          # combined graph, routes between Gemini and Ollama
npx tsx towndown-research-agent.ts     # scoped-down research pipeline (credibility scoring + loop-back)
```

(Adjust filenames above to match whatever you actually named the files in this project.)

## What's in this project

### 1. Minimal single-node graph
A single node wrapping one Gemini call (`start → agent → end`). The simplest possible LangGraph structure — equivalent in sophistication to a raw API call, used to confirm the basic setup works before adding complexity.

### 2. Tool-calling agent (built from scratch)
A two-node graph (`agent`, `tools`) with a conditional edge (`shouldContinue`) deciding whether to route to the tool node or end, and a loop-back edge from `tools` back to `agent`. Built manually rather than using LangGraph's prebuilt `create_react_agent`, specifically to see the routing mechanics directly in code rather than through a black-boxed helper.

Includes a simple `getCurrentTime` tool (zero arguments) used to test both the positive case (model correctly calls the tool for a time-related question) and the negative case (model correctly skips the tool for an unrelated question). Verified via console logging inside the routing function, not just by checking that the final output looked correct.

Tested against both Gemini and a local Ollama model independently. Both correctly handled the zero-argument tool call. This is a partial, not complete, follow-up to an earlier finding (from a separate CrewAI project) that `llama3.2` mishandles array-typed tool arguments — this test only confirms the basic call-a-tool mechanism works, since the tool used here takes no arguments at all.

### 3. Combined Gemini + Ollama routing graph
Extends the tool-calling agent with a router that picks which model handles a given request, based on a simple keyword check on the input (questions containing "time" go to Gemini; everything else goes to Ollama). Verified via logs that the graph branches to the correct provider for each input.

**Important scope note:** this is request-level branching between two independent models, not collaborative or sequential reasoning. The two models never contribute to the same answer — one is selected, the other is skipped entirely.

### 4. Scoped-down research pipeline
Based on a sketched "Deep Research Assistant" architecture (gather sources → evaluate credibility → extract facts → generate report, with a loop-back if too few sources pass a credibility threshold). Source gathering is faked using a hardcoded pool of sample sources (deliberately mixed quality) rather than real web scraping, since scraping wasn't the learning target.

Graph: `gather_sources → evaluate_credibility → (conditional: enough good sources? → extract_facts, or → loop back to gather_sources) → extract_facts → generate_report → end`

Credibility scoring and fact extraction/report generation are split across providers — scoring is the judgment-heavy task, extraction/drafting is more mechanical.

## Known issues and findings

**Gemini rate limits:** the free tier caps `gemini-2.5-flash` at a low daily request count. Cumulative testing across this project (plus a separate Genkit project using the same key) can exhaust this quota mid-session, surfacing as a `429 Too Many Requests` error. This is a hard daily cap, not a transient outage — the error's suggested retry delay (~20s) applies to a single request backoff, not the full quota reset. If this happens, either wait for the daily reset or switch the affected step to Ollama.

**State-tracking bug (fixed):** in the research pipeline, sources were initially being re-scored on a second pass through the loop-back, because the filter used to identify "already scored" sources didn't reliably account for how the state reducer concatenates rather than replaces the source list across loop iterations. Fixed by explicitly tracking already-scored URLs in a `Set` rather than relying on a `score` field surviving correctly through state updates. If extending this pipeline further, watch for the same class of bug anywhere a loop-back re-enters a node that filters based on a field set by a previous pass.

**Ollama credibility-scoring instability:** when used for credibility scoring, `llama3.2` was consistent on clearly strong sources (e.g., a Reuters article, an SEC filing) and clearly weak sources (e.g., a low-effort blog post), but inconsistent on ambiguous content — a low-substance forum comment scored 67 on one run and 20 on an identical re-run with no changes to input or code. This is based on only two data points for the ambiguous case and should be treated as a preliminary finding, not a confirmed pattern — repeated runs (5+) would be needed to confirm this isn't a one-off fluke. If using local models for any kind of scoring/filtering task, don't assume consistency on borderline cases without testing it directly.

## Not yet tested

- Real web scraping or retrieval — all source data in the research pipeline is hardcoded.
- Model-based or classifier-based routing — the Gemini/Ollama router uses a simple keyword check, not a realistic routing strategy.
- Tool calls with structured/array arguments under LangGraph specifically (only zero-argument tools tested here).
- Persistent state or memory across multiple separate `graph.invoke()` calls — each run in this project is independent.
- LangGraph's prebuilt `create_react_agent` (intentionally avoided in favor of building the graph manually).
