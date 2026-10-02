import type { InterviewMessage, SkillList } from "./types";

const BASE = import.meta.env.VITE_PRISM_BACKEND ?? "http://127.0.0.1:8000";

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
