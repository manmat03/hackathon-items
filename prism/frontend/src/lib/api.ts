import type { InterviewMessage, SkillList } from "./types";
import { ALL_SKILLS } from "./types";

const BASE = import.meta.env.VITE_PRISM_BACKEND ?? "http://127.0.0.1:8000";

/** Mock mode: set VITE_PRISM_MOCK=1 at build time, or append ?mock=1 to the
 *  URL at runtime. Routes streamInterviewNext and evalDescription through
 *  hardcoded fixtures so the voice loop can be tested without a backend. */
export function mockMode(): boolean {
  if (import.meta.env.VITE_PRISM_MOCK === "1") return true;
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("mock") === "1" || params.has("mock");
}

/** Collapse a conversation into a single Q/A paragraph for /eval. */
export function historyToWorkDescription(messages: InterviewMessage[]): string {
  const lines: string[] = [];
  let lastLumo = "";
  for (const m of messages) {
    if (m.role === "lumo") {
      lastLumo = m.content.trim();
    } else {
      const answer = m.content.trim();
      if (!answer) continue;
      if (lastLumo) lines.push(`Q: ${lastLumo}`);
      lines.push(`A: ${answer}`);
      lastLumo = "";
    }
  }
  return lines.join("\n\n");
}

export async function evalDescription(description: string): Promise<SkillList> {
  if (mockMode()) {
    return mockEval(description);
  }
  const url = new URL(`${BASE}/eval`);
  url.searchParams.set("work_description", description);
  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) throw new Error(`eval failed: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as SkillList;
  if (!data || !Array.isArray(data.skills)) {
    throw new Error("eval returned an unexpected shape");
  }
  return data;
}

/** SSE event shapes emitted by POST /interview/stream */
export type StreamEvent =
  | { type: "token"; text: string }
  | { type: "done"; wrap_up: boolean }
  | { type: "error"; message: string };

/** Streams Lumo's next utterance. Yields token events as they arrive, then
 *  a single `done` event. Caller is responsible for stripping the
 *  [END_INTERVIEW] sentinel from both display and TTS. */
export async function* streamInterviewNext(
  messages: InterviewMessage[]
): AsyncGenerator<StreamEvent> {
  if (mockMode()) {
    yield* mockStream(messages);
    return;
  }
  const res = await fetch(`${BASE}/interview/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok || !res.body) {
    yield { type: "error", message: `stream failed: ${res.status}` };
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.replace(/^data:\s*/, "");
      try {
        yield JSON.parse(payload) as StreamEvent;
      } catch {
        // Skip malformed chunks; the stream will recover on the next event.
      }
    }
  }
}

/** Sentinel the backend LLM appends when it decides to end the interview. */
export const END_SENTINEL = "[END_INTERVIEW]";

export function stripEndSentinel(text: string): string {
  return text.replace(END_SENTINEL, "").trim();
}

/* ---------------- Mock mode ---------------- */

const MOCK_LUMO_SCRIPT: string[] = [
  "Hi, I'm Lumo. So — what have you been working on lately?",
  "Nice. Walk me through what your part of that actually looked like, day to day.",
  "That's helpful. When something went sideways on that engagement, what tended to be your move?",
  "Okay — switching gears a bit. What tools are in your hands by now, the stuff you reach for without thinking?",
  "Last one. If you could pick your next engagement, what would it look like, and what would you be hoping to grow into?",
  `Really appreciate you walking through all that — I've got what I need. Give me a moment and I'll put together your reading. ${END_SENTINEL}`,
];

async function* mockStream(
  messages: InterviewMessage[]
): AsyncGenerator<StreamEvent> {
  // The Nth Lumo turn is picked by how many Lumo messages are already in history.
  const lumoTurnsSoFar = messages.filter((m) => m.role === "lumo").length;
  const scriptLine =
    MOCK_LUMO_SCRIPT[Math.min(lumoTurnsSoFar, MOCK_LUMO_SCRIPT.length - 1)];

  // Stream it character-by-chunk so the UI exercises its streaming path.
  const chunks = scriptLine.match(/.{1,8}/g) ?? [scriptLine];
  for (const chunk of chunks) {
    await new Promise((r) => setTimeout(r, 35));
    yield { type: "token", text: chunk };
  }
  yield {
    type: "done",
    wrap_up: scriptLine.includes(END_SENTINEL),
  };
}

async function mockEval(_description: string): Promise<SkillList> {
  // Hardcoded reading that mirrors the artifact mock, so the horizon chart
  // paints convincingly without any backend LLM call.
  const scores: Record<string, number> = {
    "Next Gen TechOps": 1,
    "Risk Assessments": 2,
    "Security / Cybersecurity": 2,
    "Selection, Design, and Architecture": 3,
    "System Implementation / SDLC": 3,
    "Technology Frameworks, Standards and Regulations": 2,
    "Business Continuity Management": 3,
    "Cloud": 4,
    "Data (Governance & Privacy)": 1,
    "Development": 5,
    "IT Controls and IPE": 3,
    "IT Department Governance": 2,
    "IT Service Management & Delivery": 2,
    "Networking (Operations)": 1,
  };
  await new Promise((r) => setTimeout(r, 400));
  return {
    skills: ALL_SKILLS.map((name) => ({ name, score: scores[name] ?? 0 })),
  };
}
