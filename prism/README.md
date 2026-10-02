# Prism

A voice conversation with Lumo that becomes a staffing-ready reading of someone's skills and work style.

**Status**: MVP branch `prism-mvp`. Visual direction locked, voice loop built, backend streaming endpoint built. Needs Azure OpenAI credentials to run against the real LLM; a `?mock=1` flag runs the whole UI end-to-end without them.

---

## Day 1 — Get it to a working MVP

Everything is built; this is the ordered path from a fresh clone to "the voice loop works end-to-end against the real Azure LLM." Expect 30–60 minutes if the Azure values are already in hand.

### Step 1 — Pull the branch
```sh
git checkout prism-mvp
git pull
```

### Step 2 — Backend setup

**Prereqs**: Python ≥ 3.13 and [uv](https://docs.astral.sh/uv/). Install uv with `curl -LsSf https://astral.sh/uv/install.sh | sh` if you don't have it.

```sh
cd prism/backend
uv sync
cp .sample.env .env
```

Open `.env` and fill these values. They come from the **Protiviti Azure OpenAI gateway**, not from a plain Azure portal — the subscription/auth headers are gateway-specific. If you have access to the Constellation project's `.env` (sibling folder in this repo), **it uses the same gateway and the same values will work here**.

| Variable | What goes here | How to find it |
|---|---|---|
| `BASE_URL` | The Azure OpenAI endpoint, e.g. `https://<gateway-host>/openai` | Protiviti IT or whoever provisioned your gateway access |
| `API_VERSION` | A valid Azure OpenAI API version string, e.g. `2024-08-01-preview` | Latest supported by the gateway |
| `SUBSCRIPTION_HEADER` | The HTTP header name the gateway uses to accept your subscription key, e.g. `Ocp-Apim-Subscription-Key` | Gateway docs |
| `SUBSCRIPTION_KEY` | The actual subscription key value | Gateway admin / portal |
| `AUTHENTICATION_TYPE_HEADER` | Header name the gateway uses to select auth type | Gateway docs |
| `AUTHENTICATION_TYPE_VALUE` | Its value (usually something like `AAD` or `BearerToken`) | Gateway docs |
| `TENANT_ID` | Azure AD tenant ID | Azure portal → Microsoft Entra ID → Tenant properties |
| `CLIENT_ID` | Azure AD application (client) ID with permission to call the gateway | App registration in Entra ID |
| `TOKEN_SCOPE` | The scope URI, usually `api://<guid>/.default` | App registration → API permissions |

**Confirm the model deployment name.** `main.py` has `model = "gpt-4-1-20250414-gs"`. That's the exact Azure deployment name on the Protiviti gateway for GPT-4.1. If your deployment uses a different name (or if the gateway has moved to a newer GPT-4.1 revision), change this one line.

### Step 3 — Boot the backend
```sh
uv run uvicorn main:app --reload
```
Expected: server listening on http://127.0.0.1:8000. **The first request from the frontend** will pop up a browser window asking you to sign in with Azure AD (`InteractiveBrowserCredential`). Sign in with your Protiviti account. This only happens once per server run.

Quick smoke test from another terminal:
```sh
curl -X POST http://127.0.0.1:8000/interview/stream \
  -H "Content-Type: application/json" \
  -d '{"messages": []}'
```
You should see a trickle of `data: {"type":"token","text":"..."}` events as Lumo generates its opener, then `data: {"type":"done","wrap_up":false}`. If you see 401 → token issue. If 404 → the model deployment name in `main.py` doesn't match the gateway. If a hang → the AAD popup is probably waiting for you.

### Step 4 — Frontend setup
```sh
cd prism/frontend
npm install
npm run dev
```
Expected: Vite dev server on http://localhost:5173.

### Step 5 — Click through the loop (the real test)
Open **http://localhost:5173** in Chrome, Safari, or Edge (Firefox falls back to a textarea; works but not voice).

1. Welcome screen renders with the big navy Lumo orb.
2. Click **Begin** → Interview screen loads, Lumo starts speaking the opener out loud.
3. Browser prompts for mic access → **allow**.
4. After Lumo finishes, the orb label changes to `Lumo · listening`.
5. Speak any answer, pause ~1.5 s.
6. Lumo responds with a follow-up in your own words.
7. After roughly 6–10 turns Lumo wraps and you land on Results with the horizon chart.

**If any step fails**: start with the "First-time failure modes" section below.

### Step 6 — Tune Lumo

Once the loop works end-to-end, two things to tune:

- **Prompt** (`LUMO_SYSTEM_PROMPT` in `prism/backend/main.py`) — listen to a full conversation. If Lumo asks dumb follow-ups, repeats questions, or sounds HR-robotic, edit the prompt. It's the single highest-leverage knob.
- **Voice** (automatic in `prism/frontend/src/lib/speech.ts`) — if Lumo sounds nasal or robotic on your machine, download the Premium Siri voices on macOS (System Settings → Accessibility → Spoken Content → Manage Voices → download Ava Premium or Zoe Premium). The voice picker will auto-prefer them. Alternatively, see the "What needs to be built" section for the cloud-TTS path.

That's MVP. Everything else in the "What needs to be built" section further down is a stretch target, not a blocker.

### First-time failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Backend 401 / "token acquired for wrong audience" | `TOKEN_SCOPE` wrong, or AAD app lacks permission | Verify scope matches the gateway's expected `api://<guid>/.default` |
| Backend 404 on model | `model` string in main.py doesn't match the gateway's deployment | Change `model = "..."` to the exact deployment name |
| Backend hangs on first call | AAD popup is waiting; you missed the browser window | Look for the sign-in tab, complete it |
| Frontend CORS error | Backend running on something other than :8000 or :5173 origin changed | CORS allow list in main.py currently covers `http://localhost:5173` and `http://127.0.0.1:5173` — add other origins there |
| Mic permission not asked | Running over `http://` on a non-localhost origin | Use `localhost` or set up HTTPS; mic APIs require secure context |
| Lumo doesn't speak out loud | OS audio off, or Chrome tab muted | Check tab mute icon, OS volume |
| STT returns nothing | Mic muted, or browser is Firefox | Allow mic; use Chrome/Safari/Edge, or type into the fallback textarea |
| Results screen is blank | `/eval` returned an error — check backend logs | Usually prompt-injection or malformed input; test with the mock first |

### Can't get Azure yet?

Open **http://localhost:5173/?mock=1** — the whole UI runs with a hardcoded 6-turn Lumo script and hardcoded skill scores. Zero backend calls. Useful for working on the UI, demoing the flow, or verifying everything but Azure before the keys arrive.

---

## For the engineer picking this up

### What's here

```
prism/
├── VISION.md              Long-term direction (don't change without discussion)
├── PRODUCT.md             Durable product truth + 8 load-bearing principles
├── README.md              This file
├── DESIGN_DOC.md          Original narrow spec. Superseded by VISION.md.
├── backend/               FastAPI + Azure OpenAI (gpt-4-1-20250414-gs via Protiviti gateway)
│   ├── main.py            Endpoints below
│   ├── pyproject.toml
│   ├── .sample.env        Copy to .env, fill in Azure values
│   └── tables/boards      Unused by Prism (shared helper)
└── frontend/              SolidJS + TypeScript + Vite
    ├── src/
    │   ├── main.tsx
    │   ├── routes/        Welcome, Interview, Results
    │   ├── components/    Lumo (orb), TranscriptPane
    │   ├── lib/           api, speech, store, types, questions
    │   └── styles/        tokens + global
    └── package.json
```

### Backend endpoints

| Endpoint | Shape | Status |
|---|---|---|
| `POST /interview/stream` | Takes `{messages: [{role: "lumo" \| "user", content: string}]}`. Streams Lumo's next utterance as Server-Sent Events: `data: {"type":"token","text":"..."}` per chunk, then `data: {"type":"done","wrap_up":bool}`. Uses Azure OpenAI chat completions streaming. System prompt in `LUMO_SYSTEM_PROMPT`. | **Built, needs Azure creds to run.** |
| `PUT /eval` | Takes a JSON body `{"work_description": string}`. Scores one text paragraph against all 14 skills via `client.responses.parse` with structured output. Returns the full `SkillList`. Fix for the "doesn't return" bug is applied. | **Built, needs Azure creds.** |
| `GET /skills` | Returns the saved pickle. Seeds a default list on first read (fix applied). | **Built, needs Azure creds only for the first write via `/eval`.** |
| `PATCH /skills?skill_name=&skill_level=` | Bumps one skill. Still has a latent bug: reads `skill.level` but the model field is `score`. Not used by the current UI. | **Known bug, not blocking.** |

### Frontend flow

```
Welcome  →  Interview  →  Results
   │           │              │
   │           │              └── reads history from store, calls /eval,
   │           │                  renders horizon chart (navy pills on white,
   │           │                  sunrise sun above the strongest skill)
   │           │
   │           └── on mount: calls streamInterviewNext(history),
   │               speaks each sentence as it streams via browser TTS,
   │               starts STT when Lumo finishes,
   │               pushes user turn to history on STT auto-end (silence VAD),
   │               loops. When Lumo emits [END_INTERVIEW] it transitions to
   │               Results.
   │
   └── big navy Lumo orb, Begin button, resets store on click
```

Transcript pane on the right of Interview shows the full running conversation (both Lumo and user turns) — purely trust-building display, never a confirmation step.

### Visual direction (locked — do not change without discussion)

- **Palette**: pure white (`#FFFFFF`) ground, Protiviti navy (`#002D4D`, `#002140`) as the hero color.
- **Sunrise accent** (`#E8923C`): spent in exactly ONE place on the entire product — the single sun above the strongest skill on the Results chart. Do not spread it.
- **Faces**: Spectral (italic serif) for display and prose, Figtree (sans) for small caps / data labels. Both via Google Fonts in `index.html`.
- **Lumo**: a navy breathing orb. Abstract on purpose — no face, no persona, no avatar. CSS-only in `src/components/Lumo.{tsx,css}`.
- Full tokens in `src/styles/tokens.css`.

## What's verified at the code level

- [x] TypeScript compiles clean (`npx tsc --noEmit`)
- [x] Vite production build succeeds (`npx vite build`)
- [x] Vite dev server starts without errors
- [x] Backend code is syntactically correct and routes mount
- [x] Mock mode is wired for both `/interview/stream` and `/eval`

## What needs verification (hasn't been exercised in a real environment)

- [ ] `/interview/stream` against a real Azure OpenAI deployment — **this is your first job once the keys are in.** Hit it with a Pydantic-shaped payload and confirm tokens stream, then confirm the `[END_INTERVIEW]` sentinel fires after ~6–7 user turns.
- [ ] `/eval` returning a non-null `SkillList` with real Azure
- [ ] Browser TTS actually speaks on the demo machine (varies by OS/browser)
- [ ] Browser mic permission flow + Web Speech API STT returns usable transcripts
- [ ] Horizon chart proportions at demo resolution
- [ ] End-to-end wall-clock latency (user pause → Lumo first word) — should be ~1–2 s with the stitched stack

## What needs to be built (deferred from this PR)

- [ ] `POST /transcribe` endpoint using Azure OpenAI Whisper, so STT quality is consistent across browsers and languages. Right now STT is client-side via Web Speech API.
- [ ] `POST /interview/finalize` endpoint returning a structured `PersonalityProfile` (work style, strengths, growth areas, motivators, staffing summary). Results currently uses hardcoded placeholder copy for the aside blocks, labeled as such.
- [ ] Lumo interruption: user clicks or speaks while Lumo is mid-sentence, Lumo stops immediately and listens.
- [ ] Fix `PATCH /skills` to use `.score` instead of `.level`.
- [ ] Decision: cloud TTS (Azure Speech, ElevenLabs) to replace browser `speechSynthesis` so Lumo sounds identical regardless of demo machine. Currently we auto-pick the best voice installed on each device.
- [ ] PeoplePlanner integration (long-term vision — not hackathon scope).

## Setup for the demo

### Backend (needs your Azure credentials)

```sh
cd prism/backend

# Install uv first if you don't have it (astral.sh/uv), then:
uv sync

# Fill in Azure values
cp .sample.env .env
# Edit .env with real values for:
#   BASE_URL                    (Azure endpoint)
#   API_VERSION                 (e.g. 2024-08-01-preview)
#   SUBSCRIPTION_HEADER         (Protiviti gateway subscription header name)
#   SUBSCRIPTION_KEY            (its value)
#   AUTHENTICATION_TYPE_HEADER  (Protiviti gateway auth type header name)
#   AUTHENTICATION_TYPE_VALUE   (its value)
#   TENANT_ID                   (Azure AD tenant)
#   CLIENT_ID                   (Azure AD app)
#   TOKEN_SCOPE                 (e.g. api://<guid>/.default)

uv run uvicorn main:app --reload
# Serves on http://127.0.0.1:8000
```

The first request will pop up a browser window asking you to sign in to Azure AD (`InteractiveBrowserCredential`). This is expected and only happens once per session.

### Frontend

```sh
cd prism/frontend
npm install
npm run dev
# Serves on http://localhost:5173 (falls through to 5174 if busy)
```

Open http://localhost:5173.

### Mock mode (test the UI without a backend)

Open http://localhost:5173/?mock=1 — hardcoded Lumo script and hardcoded skill scores, zero network calls. Useful for working on the UI without burning tokens.

## How to test the voice loop

With both servers running:

1. Open http://localhost:5173 — Welcome screen.
2. Click **Begin** — Interview screen loads, Lumo starts speaking the opener.
3. Allow mic access when the browser prompts (first time only).
4. Speak an answer. Pause for ~1.5 s to signal end-of-turn.
5. Lumo responds with a follow-up or transition in your own words.
6. After ~6–7 turns Lumo wraps and the Results screen loads.
7. Confirm the horizon chart shows 14 pills, the strongest has the sunrise sun above it, and the exec summary line names your top skills.

If any step fails, check:
- Backend terminal for Azure errors (401 = token issue, 404 = wrong deployment name, timeout = gateway)
- Browser devtools console (frontend network calls to `/interview/stream` and `/eval`)
- `prism/backend/current_skills.pkl` exists after the first successful `/eval` call

## Known tuning knobs

- **Lumo's tone / behavior** — `LUMO_SYSTEM_PROMPT` in `prism/backend/main.py`. Expect to iterate once you hear it in real conversations.
- **Lumo's voice** — auto-picked at runtime in `prism/frontend/src/lib/speech.ts`. See `PREFERRED_NAMES`. On macOS, downloading Premium versions of Ava / Zoe / Allison (System Settings → Accessibility → Spoken Content → Manage Voices) upgrades Lumo dramatically.
- **STT language / behavior** — `rec.lang = "en-US"` and `rec.continuous = false` in `speech.ts`. The non-continuous flag is what gives us VAD-based turn ends.
- **Model name** — `model = "gpt-4-1-20250414-gs"` in `main.py`. If your Azure deployment uses a different name, change it here.
- **Mock script** — `MOCK_LUMO_SCRIPT` in `src/lib/api.ts`. Edit if you want to demo a different conversation.

## Scope reminders

- **No scoring on screen during the interview.** Non-negotiable (PRODUCT.md principle 4). The interviewee never sees skill bars or progress rubrics while they're talking.
- **Lumo is abstract.** No face, no persona, no illustrated character. A navy breathing orb is the whole visual (PRODUCT.md principle 5).
- **Continuous conversation.** No "I heard that →" confirmation step; Lumo responds immediately after each user pause (PRODUCT.md principle 6, which supersedes an earlier draft principle).
- **All 14 skills are first-class.** None is hidden or dropped from the UI (PRODUCT.md principle 8).
