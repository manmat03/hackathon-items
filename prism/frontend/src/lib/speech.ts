/** Thin wrappers around browser speech APIs so the UI never touches them directly.
 *  Falls back gracefully when a browser lacks support (Firefox, locked-down iframes).
 */

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export const ttsSupported = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

export const sttSupported = () =>
  typeof window !== "undefined" &&
  !!(window.SpeechRecognition || window.webkitSpeechRecognition);

/* ---------------- Lumo voice selection ----------------
 *
 * Browser speechSynthesis exposes a list of installed voices via
 * speechSynthesis.getVoices(). The list is empty until the voiceschanged
 * event fires (Chrome quirk), and the names vary wildly across OS and
 * browser combinations. We score every voice against what Lumo should
 * sound like — soft, warm, calm, English — and pick the best one.
 *
 * Preference order (highest score wins):
 *   1. Known great Siri / Microsoft Natural / Google Studio voices
 *   2. Any voice whose name mentions Premium / Enhanced / Natural / Neural
 *   3. Any en-US / en-GB / en-AU female-leaning voice by common name
 *   4. The system default
 *
 * Known-bad voices (novelty, deep-male defaults) are explicitly deranked
 * so Lumo never ends up as Alex or Fred by accident.
 */

const PREFERRED_NAMES = [
  // macOS Siri — premium quality
  "Ava (Premium)", "Ava (Enhanced)", "Ava",
  "Zoe (Premium)", "Zoe (Enhanced)", "Zoe",
  "Allison (Premium)", "Allison (Enhanced)", "Allison",
  "Serena (Premium)", "Serena (Enhanced)", "Serena",
  "Nicky (Premium)", "Nicky (Enhanced)", "Nicky",
  // Microsoft Edge natural voices
  "Microsoft Jenny Online (Natural) - English (United States)",
  "Microsoft Aria Online (Natural) - English (United States)",
  "Microsoft Libby Online (Natural) - English (United Kingdom)",
  // Google Chrome cloud voices
  "Google UK English Female",
  "Google US English",
  // Reasonable standard-quality fallbacks
  "Samantha", "Karen", "Fiona", "Tessa", "Moira",
];

const BAD_NAME_FRAGMENTS = [
  "alex", "daniel", "fred", "ralph", "bruce", "bells", "zarvox",
  "trinoids", "whisper", "bubbles", "deranged", "cellos", "pipe organ",
  "princess", "boing", "bahh", "junior", "kathy", "good news", "bad news",
  "hysterical", "albert", "superstar", "jester",
];

let voiceCache: SpeechSynthesisVoice | null | undefined;

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  if (BAD_NAME_FRAGMENTS.some((bad) => name.includes(bad))) return -1000;

  let score = 0;
  const lang = v.lang.toLowerCase();

  // Language preference
  if (lang.startsWith("en-us")) score += 50;
  else if (lang.startsWith("en-gb")) score += 45;
  else if (lang.startsWith("en-au")) score += 35;
  else if (lang.startsWith("en-")) score += 25;
  else return -500; // non-English voices are out

  // Quality tier markers
  if (/\b(premium|neural|natural|studio|wavenet)\b/i.test(v.name)) score += 60;
  if (/\benhanced\b/i.test(v.name)) score += 40;

  // Explicit preference list
  const prefIdx = PREFERRED_NAMES.findIndex(
    (n) => n.toLowerCase() === name
  );
  if (prefIdx >= 0) score += 200 - prefIdx;

  // Local voices are more reliable than network voices for a demo
  if (v.localService) score += 5;

  return score;
}

export function pickLumoVoice(): SpeechSynthesisVoice | null {
  if (voiceCache !== undefined) return voiceCache;
  if (!ttsSupported()) {
    voiceCache = null;
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    // Not ready yet; caller should retry after the voiceschanged event.
    return null;
  }
  const scored = voices
    .map((v) => ({ v, s: scoreVoice(v) }))
    .filter((x) => x.s > -500)
    .sort((a, b) => b.s - a.s);

  voiceCache = scored.length > 0 ? scored[0].v : voices[0] ?? null;
  return voiceCache;
}

/** Called once at app startup to warm the voice cache. Safe to re-call. */
export function initLumoVoice(): void {
  if (!ttsSupported()) return;
  const resolve = () => {
    voiceCache = undefined;
    pickLumoVoice();
  };
  // Trigger a getVoices() so Chrome kicks off the "voiceschanged" event.
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener("voiceschanged", resolve, {
    once: true,
  });
  // Many browsers already have voices ready; try now too.
  resolve();
}

function applyLumoVoice(utter: SpeechSynthesisUtterance): void {
  const chosen = pickLumoVoice();
  if (chosen) {
    utter.voice = chosen;
    utter.lang = chosen.lang;
  } else {
    utter.lang = "en-US";
  }
  // Lumo tone: a hair slower than default, pitch very slightly below neutral
  // for warmth without going masculine.
  utter.rate = 0.95;
  utter.pitch = 0.95;
  utter.volume = 1.0;
}

export function speak(text: string, onEnd?: () => void): () => void {
  if (!ttsSupported() || !text.trim()) {
    onEnd?.();
    return () => {};
  }
  const utter = new SpeechSynthesisUtterance(text);
  applyLumoVoice(utter);
  utter.onend = () => onEnd?.();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
  return () => window.speechSynthesis.cancel();
}

/** Streaming speaker. Accepts tokens as they arrive, speaks each complete
 *  sentence immediately via the browser's TTS queue. Caller signals end
 *  of stream with .finish(); calls onComplete after the final sentence
 *  has finished playing. Cancel at any time with .cancel().
 */
export function streamingSpeaker(onComplete?: () => void) {
  if (!ttsSupported()) {
    return {
      push: (_: string) => {},
      finish: () => onComplete?.(),
      cancel: () => {},
    };
  }

  let buffer = "";
  let finished = false;
  let inFlight = 0;

  const flushSentence = (sentence: string) => {
    const text = sentence.trim();
    if (!text) return;
    const utter = new SpeechSynthesisUtterance(text);
    applyLumoVoice(utter);
    inFlight++;
    utter.onend = () => {
      inFlight--;
      if (finished && inFlight === 0) onComplete?.();
    };
    utter.onerror = utter.onend;
    window.speechSynthesis.speak(utter);
  };

  const drainReadySentences = () => {
    // Split on sentence boundaries that are followed by a space or end of buffer.
    const re = /([.!?]+)(\s+|$)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(buffer)) !== null) {
      const end = match.index + match[1].length;
      const sentence = buffer.slice(lastIndex, end);
      flushSentence(sentence);
      lastIndex = end + match[2].length;
    }
    buffer = buffer.slice(lastIndex);
  };

  return {
    push(text: string) {
      buffer += text;
      drainReadySentences();
    },
    finish() {
      finished = true;
      if (buffer.trim()) {
        flushSentence(buffer);
        buffer = "";
      }
      if (inFlight === 0) onComplete?.();
    },
    cancel() {
      finished = true;
      buffer = "";
      window.speechSynthesis.cancel();
    },
  };
}

export interface Listener {
  stop: () => void;
}

/** Starts listening; calls onFinal with the final transcript when the user pauses. */
export function listen(
  onFinal: (text: string) => void,
  onError?: (err: string) => void
): Listener {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) {
    onError?.("not-supported");
    return { stop: () => {} };
  }
  const rec = new Ctor() as any;
  // Non-continuous so the engine auto-ends on silence (built-in VAD).
  // That's the natural turn boundary we want for Gemini-style conversation.
  rec.continuous = false;
  rec.interimResults = false;
  rec.lang = "en-US";

  let finalText = "";
  rec.onresult = (ev: any) => {
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) finalText += r[0].transcript + " ";
    }
  };
  rec.onerror = (ev: any) => onError?.(ev.error ?? "unknown");
  rec.onend = () => onFinal(finalText.trim());

  try {
    rec.start();
  } catch (e) {
    onError?.(String(e));
  }

  return { stop: () => rec.stop() };
}
