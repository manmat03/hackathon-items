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
  if (!ttsSupported()) {
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
  rec.continuous = true;
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
