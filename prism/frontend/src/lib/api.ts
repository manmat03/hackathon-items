import type { SkillList, Turn } from "./types";

const BASE = import.meta.env.VITE_PRISM_BACKEND ?? "http://127.0.0.1:8000";

/** Collapse interview turns into one paragraph for the current /eval endpoint.
 *  When the backend grows a conversation-aware endpoint, swap this for the
 *  structured call; keep this shape the sole dependency the UI has on the
 *  current single-paragraph constraint.
 */
export function turnsToWorkDescription(turns: Turn[]): string {
  return turns
    .filter((t) => t.answer.trim().length > 0)
    .map((t) => `Q: ${t.question}\nA: ${t.answer.trim()}`)
    .join("\n\n");
}

export async function evalDescription(description: string): Promise<SkillList> {
  const url = new URL(`${BASE}/eval`);
  url.searchParams.set("work_description", description);

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    throw new Error(`eval failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as SkillList;
  if (!data || !Array.isArray(data.skills)) {
    throw new Error("eval returned an unexpected shape");
  }
  return data;
}
