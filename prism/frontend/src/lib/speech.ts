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

export function speak(text: string, onEnd?: () => void): () => void {
  if (!ttsSupported() || !text.trim()) {
    onEnd?.();
    return () => {};
  }
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.98;
  utter.pitch = 1.0;
  utter.lang = "en-US";
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
    utter.rate = 0.98;
    utter.pitch = 1.0;
    utter.lang = "en-US";
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
