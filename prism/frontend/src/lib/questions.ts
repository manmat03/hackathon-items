/** Client-side fallback copy, used ONLY if the backend is unreachable on
 *  open. Normal flow: the backend's Lumo agent generates every utterance
 *  via POST /interview/stream, starting with its own natural opener.
 */
export const LUMO_FALLBACK_OPENER =
  "Hi, I'm Lumo. Looks like I can't reach my brain right now — can you make sure the backend is running at :8000, then refresh?";
