# Prism Frontend

SolidJS + TypeScript + Vite. Local-only. The visual direction (navy + white, one sunrise moment, Lumo as the listening presence) is specified in `prism/VISION.md` and `prism/PRODUCT.md`; this app is its concrete execution.

## Run

```
npm install
npm run dev
```

Opens on http://localhost:5173.

The backend must be running separately at http://127.0.0.1:8000 for Lumo to speak. See `prism/backend/README.md` for its setup.

## How the conversation works

Lumo runs a continuous, Gemini-style voice conversation. There is no scripted question list, no "question X of Y" counter, no mid-turn confirmation step.

1. On open, the frontend posts an empty history to `POST /interview/stream`. The backend streams Lumo's opener as Server-Sent Events; the frontend speaks each sentence via `speechSynthesis` as it completes.
2. When Lumo finishes speaking, the browser's Web Speech API STT starts listening. It auto-ends on silence (built-in VAD).
3. The user's transcribed answer is appended to the local history and sent back to `/interview/stream` for Lumo's next turn.
4. A soft transcript pane on the right shows the full running conversation — purely a trust-building display, not a confirmation step.
5. The backend LLM decides when to wrap up (coverage across the 14 skill areas or a soft turn cap) and emits a `[END_INTERVIEW]` sentinel on its final message. The sentinel is stripped before display and TTS; the frontend sees it in the stream's `done` event and transitions to finalize.
6. Finalize concatenates every Q/A pair into one paragraph and calls `GET /eval`, which returns the 14 skill scores. The results screen renders them.

The user can hit **Wrap up →** at any time to end early.

## What's real end-to-end

- Full voice loop: STT → LLM streaming → sentence-chunked TTS.
- Backend `POST /interview/stream` using Azure OpenAI gpt-4.1 with streaming chat completions.
- Backend `GET /eval` for the final 14-skill scoring.
- Soft transcript pane as the trust-building display.

## Still mocked, for a future pass

- **Backend transcription** (`POST /transcribe`) is intentionally not built — STT runs client-side via Web Speech API. Swap in Whisper later for quality.
- **Personality / work-style / staffing summary** on Results is placeholder copy clearly labeled as such — backend produces only skill scores. Needs a `POST /interview/finalize` returning a structured `PersonalityProfile`.
- **Interruption** of Lumo mid-sentence (click to cut in) is not yet wired. User must wait for Lumo to finish the current sentence before STT resumes.

## Browser requirements

Mic access needs HTTPS or `localhost`. Web Speech API STT works in Chrome, Edge, and Safari; Firefox falls back to a visible textarea each turn.
