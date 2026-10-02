import { createSignal } from "solid-js";
import type { SkillList, Turn } from "./types";

/** Minimal cross-route store. Not reactive beyond what the two routes need.
 *  Resets on page reload — fine for the demo; no persistence requirement.
 */
export const [transcript, setTranscript] = createSignal<Turn[]>([]);
export const [result, setResult] = createSignal<SkillList | null>(null);
