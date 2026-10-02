import { Component, createSignal, onCleanup, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Lumo, LumoState } from "../components/Lumo";
import { TranscriptPane } from "../components/TranscriptPane";
import {
  createSentinelStripper,
  END_SENTINEL,
  evalDescription,
  historyToWorkDescription,
  streamInterviewNext,
  stripEndSentinel,
} from "../lib/api";
import {
  listen,
  Listener,
  streamingSpeaker,
  sttSupported,
  ttsSupported,
} from "../lib/speech";
import { history, setHistory, setResult } from "../lib/store";
import type { InterviewMessage } from "../lib/types";
import { LUMO_FALLBACK_OPENER } from "../lib/questions";
import "./Interview.css";

type Phase =
  | "booting"
  | "lumo-speaking"
  | "listening"
  | "finalizing"
  | "error";

const Interview: Component = () => {
  const nav = useNavigate();

  const [phase, setPhase] = createSignal<Phase>("booting");
  const [liveLumo, setLiveLumo] = createSignal("");
  const [typedAnswer, setTypedAnswer] = createSignal("");
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);

  let listener: Listener | null = null;
  let speaker: ReturnType<typeof streamingSpeaker> | null = null;
  let cancelled = false;

  const lumoState = (): LumoState => {
    switch (phase()) {
      case "lumo-speaking":
        return "speaking";
      case "listening":
        return "listening";
      case "finalizing":
        return "thinking";
      case "booting":
        return "thinking";
      default:
        return "idle";
    }
  };

  onMount(() => {
    runLumoTurn();
  });

  onCleanup(() => {
    cancelled = true;
    listener?.stop();
    speaker?.cancel();
  });

  /** Stream the next Lumo utterance, speak it as it arrives, then flow into
   *  listening (unless the stream signaled wrap_up). */
  const runLumoTurn = async () => {
    if (cancelled) return;
    setPhase("lumo-speaking");
    setLiveLumo("");

    let full = "";
    let wrapUp = false;

    speaker = streamingSpeaker(() => {
      // Called after the final sentence has finished playing.
      if (cancelled) return;
      const cleaned = stripEndSentinel(full);
      setHistory([...history(), { role: "lumo", content: cleaned }]);
      setLiveLumo("");
      if (wrapUp) {
        void finalize();
      } else {
        startListening();
      }
    });

    const stripper = createSentinelStripper();
    let visible = "";
    const emit = (text: string) => {
      if (!text) return;
      visible += text;
      setLiveLumo(visible.trim());
      speaker?.push(text);
    };

    try {
      for await (const ev of streamInterviewNext(history())) {
        if (cancelled) return;
        if (ev.type === "token") {
          full += ev.text;
          emit(stripper.push(ev.text));
        } else if (ev.type === "done") {
          wrapUp = ev.wrap_up || full.includes(END_SENTINEL);
          emit(stripper.flush());
          speaker.finish();
        } else if (ev.type === "error") {
          throw new Error(ev.message);
        }
      }
    } catch (e) {
      if (cancelled) return;
      console.error(e);
      // On first-turn failure: fall back to the hard-coded opener so the user
      // sees a friendly message instead of a blank screen.
      if (history().length === 0) {
        setHistory([{ role: "lumo", content: LUMO_FALLBACK_OPENER }]);
      }
      setErrorMsg(
        `Lumo can't reach the backend — ${e instanceof Error ? e.message : String(e)}. ` +
          `Make sure uvicorn is running on :8000, then click Retry.`
      );
      setPhase("error");
    }
  };

  const startListening = () => {
    if (cancelled) return;
    setPhase("listening");
    setTypedAnswer("");

    if (!sttSupported()) {
      // Fall back to text input; user clicks Submit when done.
      return;
    }
    listener = listen(
      (text) => {
        listener = null;
        if (!text.trim()) {
          // Nothing heard; keep listening on the next tick.
          startListening();
          return;
        }
        pushUserTurn(text.trim());
      },
      (err) => {
        listener = null;
        setErrorMsg(`Microphone problem: ${err}. Type instead.`);
      }
    );
  };

  const submitTyped = () => {
    const text = typedAnswer().trim();
    if (!text) return;
    setTypedAnswer("");
    pushUserTurn(text);
  };

  const pushUserTurn = (text: string) => {
    const next: InterviewMessage[] = [
      ...history(),
      { role: "user", content: text },
    ];
    setHistory(next);
    void runLumoTurn();
  };

  const finalize = async () => {
    setPhase("finalizing");
    try {
      const desc = historyToWorkDescription(history());
      const r = await evalDescription(desc);
      setResult(r);
      nav("/results");
    } catch (e) {
      setErrorMsg(
        `Couldn't finalize the reading — ${e instanceof Error ? e.message : String(e)}.`
      );
      setPhase("error");
    }
  };

  const wrapNow = () => {
    speaker?.cancel();
    listener?.stop();
    void finalize();
  };

  const retry = () => {
    setErrorMsg(null);
    runLumoTurn();
  };

  return (
    <main class="interview">
      <header class="interview-mast">
        <div class="word">
          Prism<span class="dot" aria-hidden="true" />
        </div>
        <div class="interview-mid">A conversation with Lumo</div>
        <div class="interview-right">
          <button class="link" onClick={wrapNow}>
            Wrap up →
          </button>
        </div>
      </header>

      <div class="interview-body">
        <section class="interview-stage">
          <div class="eyebrow">
            <span class="lumo-dot" />
            <span>
              <b>Lumo</b> · {phaseLabel(phase())}
            </span>
          </div>

          <Show when={liveLumo()}>
            <p class="prompt">{liveLumo()}</p>
          </Show>
          <Show when={!liveLumo() && phase() !== "error"}>
            <p class="prompt subtle">
              {phase() === "listening"
                ? sttSupported()
                  ? "Take your time — I'm listening."
                  : "Type your answer below when you're ready."
                : phase() === "finalizing"
                  ? "Reading everything you shared…"
                  : "Just a moment."}
            </p>
          </Show>

          <Lumo state={lumoState()} size={120} label={`Lumo · ${phaseLabel(phase())}`} />

          <Show when={phase() === "listening" && !sttSupported()}>
            <div class="typed">
              <textarea
                class="typed-input"
                value={typedAnswer()}
                onInput={(e) => setTypedAnswer(e.currentTarget.value)}
                placeholder="Type your answer here, then press Enter."
                rows={3}
                autofocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitTyped();
                  }
                }}
              />
              <button class="confirm" onClick={submitTyped}>
                Send
              </button>
            </div>
          </Show>

          <Show when={phase() === "error" && errorMsg()}>
            <div class="error">{errorMsg()}</div>
            <button class="confirm" onClick={retry}>
              Retry
            </button>
          </Show>
        </section>

        <TranscriptPane messages={history()} liveLumo={liveLumo()} />
      </div>

      <footer class="interview-foot">
        <span>No scoring on screen. Lumo decides when we've covered enough.</span>
      </footer>
    </main>
  );
};

function phaseLabel(p: Phase): string {
  switch (p) {
    case "lumo-speaking":
      return "speaking";
    case "listening":
      return "listening";
    case "finalizing":
      return "thinking";
    case "booting":
      return "warming up";
    case "error":
      return "stuck";
    default:
      return "idle";
  }
}

// Silence unused-import warning for ttsSupported (kept available if a future
// turn needs to branch on TTS availability).
void ttsSupported;

export default Interview;
