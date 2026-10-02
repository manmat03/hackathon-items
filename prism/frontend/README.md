# Prism Frontend — Horizon brief (hybrid demo)

SolidJS + TypeScript + Vite. Local-only. The visual direction (navy + white, one sunrise moment, Lumo as the listening presence) is specified in `prism/VISION.md` and `prism/PRODUCT.md`; this app is its first concrete execution.

## Run

```
npm install
npm run dev
```

Opens on http://localhost:5173.

The backend must be running separately at http://127.0.0.1:8000 for the final `/eval` call to work. See `prism/backend/README.md` for its setup.

## What is real vs. mocked

**Real:**
- The entire Horizon-brief visual world (Interview + Results screens).
- Lumo as the navy orb (CSS-only, abstract, breathing).
- Web Speech API for microphone input (STT) and `speechSynthesis` for Lumo's spoken questions.
- Final submit: concatenates all transcript turns and calls `GET /eval?work_description=...` on the real backend; renders the returned 14-skill scores on the Results screen.

**Mocked (client-side only):**
- Lumo's questions are a scripted array of 6; the backend has no conversation endpoint yet.
- The "I heard that →" transcript shown between turns is the raw STT result (no backend `/transcribe` call).
- The personality / work-style / staffing-summary blocks on Results use placeholder copy labeled as such — the backend does not yet produce them.

The seams are intentional: every mocked piece has a clean place to be swapped for a real backend endpoint without touching the UI.

## Browser requirements

Mic access needs HTTPS or `localhost`. Web Speech API works in Chrome, Edge, and Safari; Firefox will fall back to a text-input mode on each turn.
