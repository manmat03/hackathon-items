# Prism

A voice conversation with Lumo that becomes a staffing-ready reading of someone's skills and work style.

**Status**: MVP branch `prism-mvp`. Visual direction locked, voice loop built, backend streaming endpoint built. Needs Azure OpenAI credentials to run against the real LLM; a `?mock=1` flag runs the whole UI end-to-end without them.

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
| `GET /eval?work_description=...` | Scores one text paragraph against all 14 skills via `client.responses.parse` with structured output. Returns the full `SkillList`. Fix for the "doesn't return" bug is applied. | **Built, needs Azure creds.** |
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
