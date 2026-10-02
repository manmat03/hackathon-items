import { createSignal } from "solid-js";
import type { InterviewMessage, SkillList } from "./types";

/** Minimal cross-route store. Not reactive beyond what the two routes need.
 *  Resets on page reload — fine for the demo; no persistence requirement.
 */
export const [history, setHistory] = createSignal<InterviewMessage[]>([]);
export const [result, setResult] = createSignal<SkillList | null>(null);
