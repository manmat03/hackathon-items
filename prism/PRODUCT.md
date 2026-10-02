# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary (MVP demo):** the consultant being profiled. One person at a laptop who speaks or types about their recent work, hears/sees follow-up questions, and reviews their generated profile at the end.

**Primary (full vision, next surface after MVP):** talent managers, staffers, and MDs — the people deciding where to assign consultants on engagements. The staffer view is called out as the next surface after the MVP ships; not part of this MVP.

**Not the audience:** external recruiters, HR reporting pipelines, formal performance reviews.

## Product Purpose

Prism replaces the self-assessment form with a natural interview. The consultant talks through recent projects, strengths, and growth areas; Prism extracts (a) 0–5 scores across the 14 Protiviti IT-consulting skill categories, (b) a personality / work-style profile, and (c) a staffing-ready summary a talent manager or MD can skim in 30 seconds. Success is: a staffer prefers reading Prism's output over the consultant's resume paragraph when deciding where to staff them.

## Positioning

Conversation-first talent profiling. Forms produce sanitized self-ratings; a short real interview surfaces skill depth, work style, and motivators that forms cannot. The output is structured enough to drop into a staffing conversation and specific enough to beat the resume paragraph.

## Operating Context

- Runs locally on the consultant's own machine for the hackathon — no deploy, no auth, no sessions, single-user pickle persistence.
- Backend already exists: Python 3.13 + FastAPI + Azure OpenAI (`gpt-4-1-20250414-gs`), authenticated via `InteractiveBrowserCredential` against Protiviti's Azure gateway. Env vars live in `prism/backend/.sample.env`.
- Frontend does not exist yet; the design-doc stack decision is SolidJS (not SolidStart) + TypeScript. Local dev only.
- The interview flow replaces the stale "one paragraph, hit submit" interaction and is the primary surface being planned.

## Capabilities and Constraints

**Capabilities today (backend-only):**
- `GET /eval?work_description=...` — score one text paragraph against 14 skills via structured output; persist to `current_skills.pkl`.
- `GET /skills` — return the stored list.
- `PATCH /skills?skill_name=&skill_level=` — bump one skill upward.

**Target capabilities (full product):**
- Multi-turn interview, voice-in / voice-out, with an interviewer agent that probes and rotates coverage across skills.
- Three structured outputs: skill scores, personality / work-style profile, staffing-ready summary.
- Export of the full profile.

**MVP capabilities (first frontend ship, this planning cycle):**
- Typed-paragraph input mapped to the existing `GET /eval` endpoint.
- Results view showing the 14 skill scores and a (TBD) extracted profile section.
- Voice I/O and multi-turn interview are deliberately deferred to the next iteration; the MVP proves the end-to-end loop with the existing backend.

**Known backend bugs to fix the moment they block demo wiring** (logged, not fixed yet): `/eval` returns `None`; `PATCH /skills` reads `skill.level` but the field is `score`; `GET /skills` 500s on a fresh install because the pickle doesn't exist.

**Durable constraints:**
- Skill taxonomy is fixed by Protiviti: 14 enumerated IT-consulting categories defined in `prism/backend/main.py`. Any UI must display all 14; no renaming or reordering without the taxonomy owner.
- Scoring scale is fixed 0–5 (0 = none, 5 = expert).
- Local-first for the hackathon: no auth, no multi-user, no PeoplePlanner integration.

**Terminology:**
- *Consultant / interviewee* — the person being profiled.
- *Staffer / talent manager / MD* — the eventual consumer of the profile.
- *Lumo* — the interviewer agent; the voice the interviewee talks with. A named presence, not a persona with a face.
- *Skill score* — a 0–5 rating on one of the 14 categories.
- *Profile* — the full output: skills + personality + staffing summary.

## Brand Commitments

- **Name:** Prism. Locked.
- **Context:** Protiviti internal tool. The 14-skill taxonomy carries the Protiviti identity, but no Protiviti logo or official assets are supplied for this hackathon.
- **Visual direction:** open. The product may lean toward a Protiviti-adjacent palette (navy/red as a reference anchor) but is not required to match Protiviti's identity precisely. New-work decides the visual world; no binding assets to preserve.
- **Voice:** warm, direct, professional. The product is talking *with* the consultant, not evaluating them. No HR-ese.

## Evidence on Hand

- `prism/VISION.md` — long-form product direction.
- `prism/DESIGN_DOC.md` — original narrow spec (paragraph → `/plaintext`), now superseded by VISION.md and this file.
- `prism/backend/main.py` — working backend with `/eval`, `/skills`, `PATCH /skills` and the 14-skill `SkillName` enum.
- `prism/backend/.sample.env` — Azure OpenAI gateway env schema.
- No marketing copy, testimonials, screenshots, logos, or user research exist. Future work must not fabricate them.

## Product Principles

1. **Conversation over forms.** When a follow-up question would get better data than a structured field, ask.
2. **The output is the product.** The results screen must be good enough that a staffer prefers it to the resume paragraph.
3. **Human tone, short turns.** The interviewer feels like a warm colleague, not an HR bot.
4. **No scoring on screen during the interview.** The interviewee never sees skill bars, scores, progress rubrics, or any live measurement while they're talking. Scoring belongs on the Results screen. The reason is anxiety reduction: visible scoring makes people drop buzzwords to make bars climb instead of telling the truth. This is non-negotiable.
5. **Lumo talks with them, not at them.** The interviewer agent has a name — **Lumo** — and a visible listening presence (a breathing orb, not an avatar or face). Lumo introduces itself, asks real follow-ups to vague answers, and feels like a warm colleague who's genuinely curious. The interviewee is talking *to Lumo*, not into a void and not into a form.
6. **Continuous conversation, with a visible transcript — no mid-turn confirmation.** The interview feels like Gemini voice mode: the interviewee talks, pauses, Lumo responds immediately, no "I heard: ..." confirmation step gating the next turn. A soft transcript pane sits visibly beside the conversation showing both sides as they go — purely a trust-building display, not a prompt for the interviewee to approve each turn. Lumo is responsible for recovering from any mishearing in-conversation ("sorry, could you repeat that?" or just rolling with context), the way a real conversational partner does. *(This supersedes an earlier draft principle that required a per-turn "I heard that →" confirmation; that pattern made the exchange feel turn-based and quiz-like, which the vision explicitly rejects.)*
7. **Local-first for the hackathon.** Prove the loop end-to-end before adding auth, multi-user, or system-of-record integration.
8. **Respect the taxonomy.** All 14 skills are first-class; none is quietly dropped or hidden in the UI.

## Accessibility & Inclusion

MVP floor: every control reachable by keyboard; text meets WCAG AA contrast. No formal screen-reader audit is required for the hackathon demo, but no choice in the MVP should make a future AA upgrade significantly harder (semantic HTML, labelled form controls, visible focus states).
