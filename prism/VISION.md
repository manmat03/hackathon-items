# Prism — Vision

> Long-term direction for Prism. Not a build plan. Separate from any audit of what the hackathon repo currently contains.

---

## The problem

Forms are the wrong tool for understanding people. Self-assessment paragraphs are stale, sanitized, and biased toward what the writer thinks the reader wants to hear. Talent managers and MDs reading them come away knowing which boxes a person ticks on paper, but not how that person actually works, what they care about, or whether they'd be good to staff on a given engagement.

## The vision

Prism replaces the self-assessment form with a **natural, voice-based conversation** — closer to an interview with a friend than a performance review. The person talks about their recent work, their projects, what went well, what they'd do differently; an interviewer agent asks real follow-ups. From that conversation, Prism produces three things:

1. **Skill scores** across the 14 Protiviti IT-consulting categories (0–5).
2. **A personality / work-style profile** — how they think, how they collaborate, what motivates them, what they're growing into, what kinds of projects they thrive on.
3. **A staffing-ready summary** a talent manager or MD can skim in 30 seconds when deciding where to put this person.

The pitch: *staffers see the real person, not the resume version.*

## Who it's for

- **Primary**: talent managers and staffers who assign people to engagements, and MDs who vouch for them.
- **Secondary**: the person being interviewed — they get a mirror that captures their experience more accurately than they could articulate in writing.
- **Not the primary audience**: external recruiters, HR reporting, performance review.

## Core interaction

Voice in, voice out. User hits start, hears an opening question, speaks their answer. The interviewer agent probes vague answers, rotates coverage across skill areas, and wraps when it has enough signal (~10–15 minutes). User sees a transcript scrolling as they go. At the end: a results screen with the three outputs above, exportable.

## Design principles

- **Conversation beats forms**: never ask the user to fill in structured fields when a follow-up question would get better data.
- **The interview feels human**: short turns, real follow-ups, warm tone — not a scripted chatbot.
- **The output is the product**: skill scores and personality profile must be good enough that a staffer prefers reading Prism's summary over the person's resume paragraph.
- **Local-first for the hackathon**: no auth, no multi-user, no system-of-record integration. Prove the loop first.

## Future scope (post-hackathon)

- **Push to PeoplePlanner** — the long-term play. Prism's output flows into the existing internal talent-management system so staffing decisions already use it.
- Multi-user, per-person history (re-interview quarterly, show skill drift over time).
- Interviewer agent uses tools (prior sessions, project history, PeoplePlanner data) to ask smarter follow-ups.
- A reviewer surface where talent managers can read, annotate, and flag Prism profiles.

## Explicit non-goals (for the hackathon demo)

- Replacing performance reviews or formal evaluations.
- Writing to PeoplePlanner or any external system.
- Authentication, roles, or any multi-tenant concern.
- Scoring people against each other, ranking, or any comparative output.
