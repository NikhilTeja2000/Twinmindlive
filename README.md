# Twinmind Live

A session-based web app that captures live mic audio, transcribes it in ~30-second chunks via **Groq Whisper Large V3**, and generates exactly **3 contextual suggestions per refresh** plus a chat panel — both powered by **Groq GPT-OSS 120B**.

The design is driven by the assignment's actual cadence — *chunked capture → periodic transcription → periodic suggestion generation* — not by an assumption that "live audio" implies streaming WebRTC.

---

## 1. Project overview

- **Left column — Mic & Transcript.** Click mic → browser records 30s chunks → each chunk is POSTed to the API → Groq Whisper transcribes → transcript appends.
- **Middle column — Live Suggestions.** After every chunk (or on manual refresh), the API asks GPT-OSS 120B for exactly 3 suggestions, anchored to the most recent ~60–90 seconds of transcript. Newer batches render above older ones with a `— BATCH N · HH:MM:SS —` separator.
- **Right column — Chat (detailed answers).** Typed questions and clicked suggestions both go to the same session-scoped chat, grounded in the transcript + recent chat history.
- **Export.** JSON or TXT export includes transcript, every suggestion batch, full chat history, and settings — all with ISO timestamps.

No login. No persistence. One session lives entirely in server memory.

---

## 2. Architecture

```
browser                          server                         Groq
───────                          ──────                         ────

MediaRecorder ── 30s blob ──► POST /session/:id/chunks
                                    │
                                    ▼
                          AudioChunkService ─► TranscriptionService ──► whisper-large-v3
                                    │                                       │
                                    │          ◄── transcript text ─────────┘
                                    ▼
                          TranscriptContextService (last N chunks)
                                    │
                                    ▼
                          SuggestionService ─────────────────────► openai/gpt-oss-120b
                                    │                                   │
                                    │          ◄── 3-suggestion JSON ───┘
                                    ▼
                          response = { transcriptChunk, suggestionBatch }

click suggestion  ─────────► POST /session/:id/expand ─► ExpandedAnswerService ─► gpt-oss-120b
type message      ─────────► POST /session/:id/chat    ─► ChatService           ─► gpt-oss-120b
manual refresh    ─────────► POST /session/:id/refresh ─► (same suggestion path)
```

### Monorepo layout

```
.
├── apps/
│   ├── api/            # Fastify backend (TypeScript, tsx runtime)
│   └── web/            # Next.js 14 App Router frontend (React, Zustand)
├── packages/
│   └── shared/         # TS types, Zod schemas, default prompts (used by both)
├── .cursor/rules/      # Engineering guardrails (SRP, backend/frontend layering)
├── .env.example
├── package.json        # npm workspaces
└── tsconfig.base.json
```

### SRP modules

**Backend** (`apps/api/src/`)
- `clients/GroqClient` — *only* talks to Groq. Chat completions, transcriptions, and `models.list()` for key validation.
- `services/ApiKeyStore` — holds the Groq key in process memory (never serialised back).
- `services/ApiKeyValidationService` — cross-refs the 3 required model IDs against `groq.models.list()`.
- `services/SessionStore` — in-memory store for all active sessions.
- `services/SettingsStore` — in-memory runtime settings (prompts, context, model tuning).
- `services/AudioChunkService` — validates uploaded `multipart/form-data` blobs.
- `services/TranscriptionService` — Whisper call + parsing.
- `services/TranscriptContextService` — slices the last N chunks into prompt context.
- `services/SuggestionService` — builds suggestion prompt, calls the LLM with `json_schema`, guarantees 3 items.
- `services/SuggestionParser` — safety-net fallback when the LLM deviates from the schema.
- `services/ChatService` — typed-chat answers.
- `services/ExpandedAnswerService` — answers generated from a clicked suggestion.
- `services/ChunkPipelineService` — orchestrates the `chunks → transcribe → aggregate → suggest` flow.
- `services/ChatMessageFactory` — creates `ChatMessage` objects (single-responsibility naming helper).
- `services/SessionTimelineLogger` — per-session timestamped event log.
- `services/ExportService` — JSON / TXT export.
- `controllers/*` — HTTP + validation only. No business logic.

**Frontend** (`apps/web/src/`)
- `services/` — `AudioRecorderService` (MediaRecorder + 30s chunks), `ApiClient` (typed HTTP), `ExportBuilder` (client-side download).
- `stores/` — Zustand stores: `TranscriptStore`, `SuggestionStore`, `ChatStore`, `SessionStore`, `SettingsStore`.
- `hooks/` — orchestration: `useRecordingSession`, `useAutoRefresh`, `useSendChatMessage`, `useExpandSuggestion`, `useSettingsHydration`, `useSaveSettings`, `useCheckApiKey`.
- `components/` — UI only. `TranscriptPanel`, `SuggestionPanel`, `SuggestionCard`, `ChatPanel`, `MicButton`, `ExportButton`, `SettingsDrawer`.

Guardrails live in [`.cursor/rules/`](./.cursor/rules/): `backend-layering.mdc`, `frontend-layering.mdc`, and others enforce "controllers don't contain business logic, services don't know the HTTP layer, components don't fetch."

---

## 3. Stack choices

| Layer | Choice | Why |
|---|---|---|
| Monorepo | npm workspaces | Zero config, ships with Node, shared types compile once |
| Frontend | Next.js 14 (App Router) + React 18 + TypeScript | Assignment-friendly, App Router keeps a single page trivially |
| State | Zustand | Tiny, no context/provider ceremony, one store per concern |
| Styling | Tailwind CSS | Fast to iterate a clean 3-column UI, no custom design system needed |
| Backend | Fastify + TypeScript, `tsx` runtime | Fast to boot, validates JSON with Zod, multipart built-in |
| Validation | Zod (runtime) + JSON Schema (for LLM) | One schema compiles to both — strict inputs **and** strict LLM outputs |
| LLM client | `groq-sdk` 0.7 | Official SDK, low-level enough to pass `max_completion_tokens`, `reasoning_effort`, `response_format: json_schema` |

---

## 4. Why HTTP chunk upload, not WebRTC / WebSocket

The assignment's cadence is **30-second chunks**, not word-by-word streaming. WebRTC is the wrong abstraction here:

- **WebRTC** is built for full-duplex <200ms peer-to-peer media. It adds SFU/TURN infrastructure, NAT traversal, and codec negotiation — none of which help with "upload 30s of audio to a REST endpoint every 30s."
- **WebSocket** would let the server push transcripts, but since every chunk upload already returns `{ transcriptChunk, suggestionBatch }` in one response, there's nothing to push.
- **Plain HTTP `multipart/form-data`** is dead simple, trivially retryable, easy to debug in browser devtools, works through any proxy, and maps cleanly to Fastify's `@fastify/multipart`.

The result: one upload per 30s, one response containing both new transcript **and** the fresh 3-suggestion batch. The UI updates both columns atomically.

---

## 5. Required model mapping (per assignment)

> "Models: Groq for everything. Whisper Large V3 for transcription. GPT-OSS 120B for suggestions and chat. Same model for everyone so we are comparing prompt quality."

| Role | Model ID | Where it's used |
|---|---|---|
| Transcription | `whisper-large-v3` | `TranscriptionService` → `groq.audio.transcriptions.create` |
| Live suggestions | `openai/gpt-oss-120b` | `SuggestionService` → strict `json_schema` output |
| Clicked-suggestion expansion | `openai/gpt-oss-120b` | `ExpandedAnswerService` |
| Typed chat | `openai/gpt-oss-120b` | `ChatService` |

Model IDs come from `SettingsStore` (seeded by `GROQ_TRANSCRIPTION_MODEL` and `GROQ_LLM_MODEL`). The Settings drawer exposes them so a reviewer can swap in a different Groq model to compare.

### Runtime validation

`GET /settings/api-key/check` calls `groq.models.list()` and cross-refs the 3 required IDs against what the current key can actually see. The Settings drawer shows a green/red pill per role plus any Groq error (e.g. `401 Invalid API Key`). Runs automatically right after the user saves a key.

---

## 6. Prompt strategy for live suggestions

The suggestion prompt (see [`packages/shared/src/prompts.ts`](./packages/shared/src/prompts.ts)) is built as a **contract**, not an instruction. Key design choices:

1. **Recency anchoring.** The system prompt instructs the model to ground every suggestion in the most recent ~60–90 seconds of transcript. Older context is labeled as *background*, not as a prompt. This is the single biggest quality lever — without it, suggestions drift toward averaged "meeting advice."

2. **Enforced diversity.** The 3 outputs MUST each be a different *type* from the menu: `QUESTION`, `INSIGHT`, `RISK`, `CLARIFY`, `ACTION`. This removes the default LLM failure mode of returning three slight rephrasings of the same idea.

3. **Conditional FACT-CHECK.** `FACT-CHECK` is an optional sixth type that the model may use *only when* the recent transcript contains a concrete numeric claim, statistic, or named external source. Gating it removes the "fact-check everything" failure mode.

4. **One few-shot example.** A single worked example (RDS → EC2 Postgres migration) shows the model what a good triple looks like across types and recency. One example, not ten — reduces prompt tokens while preserving signal.

5. **Output shape owned by JSON schema, not the prompt.** The prompt used to list "return JSON with fields X, Y, Z." That's now removed; the server enforces it via `response_format: { type: 'json_schema', ... }`. Prompt stays focused on *what*, schema on *how*.

6. **Tight item shape.** `title`: 3–8 words, readable in under one second. `body`: 1–3 sentences, ≤55 words, must explain *what* to do and *why* it matters now.

Chat and Expand prompts are separate and simpler — they're grounded answers, not generated content menus. All four prompts (`suggestionSystem`, `suggestionUser`, `chatSystem`, `expandSystem`) are editable at runtime via the Settings drawer.

---

## 7. Context-window strategy

Context is deliberately narrow, because wider is slower and rarely better.

| Consumer | Default | Rationale |
|---|---|---|
| Suggestion generation | last **12 transcript chunks** (~6 min @ 30s) | Enough to capture a topic shift; tight enough to favor recency |
| Chat answer | last **12 chunks** + last **6 chat turns** | Turns give conversational continuity without letting old chat dominate |
| Clicked-suggestion expansion | same as chat | Suggestion text is the spotlight; transcript is the room |

`TranscriptContextService` slices these windows and formats them with explicit timestamps. All three sizes are `PUT /settings`-editable (`transcriptContextChunks`, `chatContextTurns`, `chunkSeconds`).

No rolling summary is computed server-side. The in-memory session fits comfortably in the model's context window for any realistic session length (>1 hour of speech = ~15k tokens of transcript), and a summarizer adds latency + a second failure mode. If a real product needed longer sessions, summarization would go in `TranscriptContextService` behind the same interface.

---

## 8. Structured output: `json_schema` over `json_object`

`SuggestionService` uses Groq's strict JSON Schema mode:

```ts
responseFormat: {
  type: 'json_schema',
  jsonSchema: {
    name: 'SuggestionTriple',
    schema: SuggestionTripleJsonSchema,  // requires exactly 3 items
    strict: true,
  },
}
```

The schema lives in [`packages/shared/src/schemas.ts`](./packages/shared/src/schemas.ts) next to its Zod twin. This gives us three guarantees for free:

1. **Exactly 3 items.** `minItems: 3, maxItems: 3` is enforced by the Groq server, not by retry-loops on our side.
2. **No extra properties.** `additionalProperties: false` prevents the model from inventing fields.
3. **Valid JSON always.** The model literally cannot emit malformed JSON in this mode — no `JSON.parse` retries.

`SuggestionParser` is kept as a safety net (pads / trims / repairs) so the UI invariant of "3 cards" holds even in the rare schema-violation case. With `json_schema` this path is almost never hit in practice.

---

## 9. Latency tradeoffs

Live suggestions are the critical latency path — they run inline on every chunk upload, and the user is waiting 30s for the next one. Tradeoffs made:

| Knob | Suggestions | Chat / Expand | Why |
|---|---|---|---|
| `reasoning_effort` | `low` | `medium` | Suggestions don't need deep deliberation — they're signals, not essays. Chat answers benefit from more thinking |
| `temperature` | 0.4 | 0.4 | Some variation between batches, but not creative drift |
| `max_completion_tokens` | 900 | 900 | Enough headroom; rarely hit in practice |
| Response format | `json_schema` (strict) | free-form markdown | JSON mode avoids retry loops on malformed output |
| Context window | 12 chunks | 12 chunks + 6 turns | Tighter = faster first token |

### Server-side

- `GroqClient` **reuses one `Groq` SDK instance** and only rebuilds it when `ApiKeyStore` returns a different key. Keep-alive stays intact on the hot path.
- Transcription + suggestion generation run **sequentially in one request** (the chunk POST). Theoretically they could be parallelized (generate suggestions from the *previous* transcript while the current one transcribes), but that complicates the "one atomic response" invariant. Out of scope for this submission.
- The Fastify error handler terminates fast; `HttpError` is the only typed error type that crosses the HTTP boundary.

### Client-side

- Chunks are `Blob`s collected by `MediaRecorder` in `webm/opus` (Chrome/Firefox) or `mp4/aac` (Safari). No re-encode client-side.
- No suggestion polling — the chunk response carries the new batch.
- A manual "Reload suggestions" button calls `/refresh`, which regenerates from the current transcript without needing new audio.

---

## 10. In-memory session design

Everything stateful lives in the API process:

| Store | Lifetime | Contents |
|---|---|---|
| `ApiKeyStore` | Process | The Groq API key (string). `has()` / `get()` / `set()` |
| `SettingsStore` | Process | `AppSettings` (prompts, context, models, reasoning effort) |
| `SessionStore` | Process | Map of sessionId → `{ meta, transcript, suggestionBatches, chat }` |

Server restart wipes all three. That's intentional: the assignment explicitly says **no persistence across reloads**, export is expected to be the only long-lived artifact. Absent a persistence layer, the code avoids the complexity of schemas, migrations, and recovery paths — at the cost of "close the tab = session gone."

### Security properties

- The Groq key is **never serialised back over HTTP.** `GET /settings` returns `SettingsResponse = AppSettings & { hasApiKey: boolean }`. The UI never sees the raw key.
- The browser **never calls Groq directly.** All LLM calls are proxied through the Fastify API, which reads from `ApiKeyStore` on every call.
- CORS is explicit: `CORS_ORIGINS` env var controls which origins the API accepts (`http://localhost:3000` by default).

### If this had to persist

The minimal change would be: swap `SessionStore`'s internal `Map` for a Redis or SQLite-backed adapter. All services hold a reference to `SessionStore` as an interface, so the call sites don't change. The one-process, in-memory `Map` is a deliberate simplification, not a design lock-in.

---

## 11. Setup instructions

Requires **Node 20+**.

```bash
git clone <this-repo>
cd Twinmindlive
npm install
```

Copy env templates:

```bash
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
```

### Groq API key

Two ways, in priority order:

1. **Recommended: via the UI.** Leave `GROQ_API_KEY=` blank in `apps/api/.env`. Start the server, open the app, click the gear icon, paste your key, click *Save & validate*. The Settings drawer runs a `models.list()` check and shows a green pill per role.
2. **Boot-time:** set `GROQ_API_KEY=gsk_...` in `apps/api/.env`. Useful for dev convenience. Still editable at runtime via the drawer.

Get a key at [console.groq.com/keys](https://console.groq.com/keys).

### Other env vars

See `.env.example` for the full list. Defaults are sensible; only `GROQ_API_KEY` is meaningful to set by hand.

---

## 12. How to run locally

### Dev (API + web in parallel)

```bash
npm run dev
```

- API → `http://localhost:4000` (`/health` for liveness)
- Web → `http://localhost:3000`

### Build for production

```bash
npm run build           # builds shared + api + web
npm run start:api       # terminal 1 — serves the Fastify API
npm run start:web       # terminal 2 — serves the Next.js app
```

### Typecheck all workspaces

```bash
npm run typecheck
```

### API surface

| Method | Path                              | Purpose |
|--------|-----------------------------------|---------|
| POST   | `/session/start`                  | Create a new in-memory session, returns `{ sessionId }` |
| POST   | `/session/:id/stop`               | Mark session stopped |
| POST   | `/session/:id/chunks`             | `multipart/form-data` audio chunk → `{ transcriptChunk, suggestionBatch }` |
| POST   | `/session/:id/refresh`            | Regenerate suggestions from current transcript |
| POST   | `/session/:id/chat`               | Typed user question → assistant answer |
| POST   | `/session/:id/expand`             | Clicked suggestion → detailed assistant answer |
| GET    | `/session/:id`                    | Snapshot of current session |
| GET    | `/session/:id/export?format=json` | Download export (`json` or `txt`) |
| GET    | `/settings`                       | Current settings + `hasApiKey` |
| PUT    | `/settings`                       | Update any subset of prompts / context / models / API key |
| GET    | `/settings/api-key/check`         | Cross-ref required model IDs against `groq.models.list()` |
| GET    | `/health`                         | Liveness |

---

## 13. Deployment notes

The app is two independent services plus a shared package, deployable either together or separately.

### Recommended shape

- **Frontend** on any static-plus-edge host that supports Next.js (Vercel, Netlify, Cloudflare Pages). Needs `NEXT_PUBLIC_API_BASE_URL` pointed at the deployed API.
- **Backend** on any Node 20+ host (Fly.io, Railway, Render, a Docker-capable VPS). Needs `GROQ_API_KEY` optional, `CORS_ORIGINS` set to the frontend's public URL.

### Important: single-process constraint

Because all state lives in one Node process (`SessionStore`, `ApiKeyStore`, `SettingsStore`), the backend **must run as a single instance**, not horizontally scaled behind a load balancer. Scaling out would require swapping `SessionStore` for a shared backend (Redis). This is a deliberate simplification for the scope of this assignment — see §10.

### Env vars recap

**API:**
- `GROQ_API_KEY` (optional at boot)
- `GROQ_TRANSCRIPTION_MODEL=whisper-large-v3`
- `GROQ_LLM_MODEL=openai/gpt-oss-120b`
- `API_PORT=4000`, `API_HOST=0.0.0.0`
- `CORS_ORIGINS=https://your-web.example.com`

**Web:**
- `NEXT_PUBLIC_API_BASE_URL=https://your-api.example.com`

---

## 14. Known limitations & tradeoffs

These are intentional scope choices, not unknown bugs:

- **No persistence.** Server restart wipes sessions. Export while the session is live is the only way to save it. (§10)
- **Single-process state.** Horizontal scaling requires a shared `SessionStore` backend. (§13)
- **Transcribe + suggest are sequential.** They run inline on the chunk request, not in parallel with the next chunk. Simpler to reason about; adds ~1s of suggestion latency on top of transcription. Pipelining is a ~50-line change in `ChunkPipelineService` if needed.
- **No real streaming chat.** Answers arrive as a single response, not token-by-token. `groq-sdk` supports streaming; the UI wiring is the work. Out of scope for this submission.
- **No speaker diarization.** Whisper Large V3 via Groq returns flat text. The product could benefit from "who said what" — not in the assignment.
- **Audio is not persisted server-side.** Chunks are transcribed and discarded. Nothing to replay, nothing to debug from.
- **No rolling summary.** If a session runs for many hours, the 12-chunk context window still only sees the last 6 minutes. Longer sessions would benefit from summarization in `TranscriptContextService`.
- **`groq-sdk` 0.7 type lag.** The SDK types predate `max_completion_tokens`, `reasoning_effort`, and `response_format: json_schema`. `GroqClient` has one localised cast around `chat.completions.create` to bridge this; the Groq API itself accepts the params fine.
- **Browser mic permission required.** First click on the mic triggers the browser's permission prompt; a denied permission shows an error banner and requires a page reload to re-prompt.
- **Audio codec varies by browser.** Chrome/Firefox emit `webm/opus`, Safari emits `mp4/aac`. Whisper handles both. Not a code issue, just a surface area to mention.

---

## License

MIT for this take-home submission.
