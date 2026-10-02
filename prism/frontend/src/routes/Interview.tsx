import { Component, createSignal, onCleanup, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Lumo, LumoState } from "../components/Lumo";
import { LUMO_INTRO, LUMO_QUESTIONS } from "../lib/questions";
import { listen, Listener, speak, sttSupported } from "../lib/speech";
import { transcript, setTranscript, setResult } from "../lib/store";
import { evalDescription, turnsToWorkDescription } from "../lib/api";
import type { Turn } from "../lib/types";
import "./Interview.css";

type Phase = "intro" | "asking" | "listening" | "heard" | "finalizing" | "error";

const Interview: Component = () => {
  const nav = useNavigate();

  const [index, setIndex] = createSignal(0);
  const [phase, setPhase] = createSignal<Phase>("intro");
  const [heardText, setHeardText] = createSignal("");
  const [editing, setEditing] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);

  let listener: Listener | null = null;
  let cancelSpeak: (() => void) | null = null;

  const currentQuestion = () => LUMO_QUESTIONS[index()] ?? "";
  const total = LUMO_QUESTIONS.length;

  const lumoState = (): LumoState => {
    switch (phase()) {
      case "asking": return "speaking";
      case "listening": return "listening";
      case "finalizing":
      case "heard": return "thinking";
      default: return "idle";
    }
  };

  onMount(() => {
    // Play the intro, then move to the first question.
    setPhase("asking");
    cancelSpeak = speak(LUMO_INTRO, () => {
      askCurrent();
    });
  });

  onCleanup(() => {
    cancelSpeak?.();
    listener?.stop();
  });

  const askCurrent = () => {
    setPhase("asking");
    cancelSpeak = speak(currentQuestion(), () => {
      startListening();
    });
  };

  const startListening = () => {
    setPhase("listening");
    if (!sttSupported()) {
      // Fall back to type-in-place: user hits "Done talking" after typing.
      return;
    }
    listener = listen(
      (text) => {
        listener = null;
        setHeardText(text);
        setPhase("heard");
      },
      (err) => {
        listener = null;
        setErrorMsg(`Microphone problem: ${err}. Type your answer instead.`);
        setPhase("heard");
      }
    );
  };

  const stopListening = () => {
    listener?.stop();
    listener = null;
  };

  const confirmHeard = () => {
    const answer = heardText().trim();
    const turn: Turn = { question: currentQuestion(), answer };
    setTranscript([...transcript(), turn]);
    setHeardText("");
    setEditing(false);
    setErrorMsg(null);

    if (index() + 1 >= total) {
      finalize();
    } else {
      setIndex(index() + 1);
      askCurrent();
    }
  };

  const finalize = async () => {
    setPhase("finalizing");
    try {
      const desc = turnsToWorkDescription(transcript());
      const result = await evalDescription(desc);
      setResult(result);
      nav("/results");
    } catch (e) {
      console.error(e);
      setErrorMsg(
        `Couldn't reach the backend (${e instanceof Error ? e.message : String(e)}). Is uvicorn running on :8000?`
      );
      setPhase("error");
    }
  };

  const skipAndFinalize = () => {
    stopListening();
    cancelSpeak?.();
    finalize();
  };

  return (
    <main class="interview">
      <header class="interview-mast">
        <div class="word">
          Prism<span class="dot" aria-hidden="true" />
        </div>
        <div class="interview-mid">
          A conversation with Lumo · {index() + 1} / {total}
        </div>
        <div class="interview-right">
          <button class="link" onClick={skipAndFinalize}>Finish early →</button>
        </div>
      </header>

      <section class="interview-stage">
        <div class="eyebrow">
          <span class="lumo-dot" />
          <span><b>Lumo</b> · question {index() + 1} of {total}</span>
        </div>

        <p class="prompt">{currentQuestion()}</p>

        <Lumo state={lumoState()} size={110} label={`Lumo · ${lumoLabel(phase())}`} />

        <Show when={phase() === "heard" || editing()}>
          <div class="heard">
            <div class="heard-eyebrow">I heard that →</div>
            {editing() ? (
              <textarea
                class="heard-edit"
                value={heardText()}
                onInput={(e) => setHeardText(e.currentTarget.value)}
                rows={3}
                autofocus
              />
            ) : (
              <p class="heard-text">
                {heardText() || <span class="muted">— nothing yet; try typing it in.</span>}
              </p>
            )}
            <div class="heard-row">
              <button class="link" onClick={() => setEditing(!editing())}>
                {editing() ? "Done editing" : "Something wrong? Edit"}
              </button>
              <button class="confirm" onClick={confirmHeard}>
                {index() + 1 >= total ? "Finish →" : "Sounds right →"}
              </button>
            </div>
          </div>
        </Show>

        <Show when={phase() === "listening"}>
          <div class="listening-note">
            Take your time. {sttSupported()
              ? "Lumo is listening. Pause when you're done; I'll show what I heard."
              : "Your browser doesn't do voice — type below and submit."}
          </div>
          {!sttSupported() && (
            <div class="heard">
              <textarea
                class="heard-edit"
                placeholder="Type your answer here, then press Submit."
                value={heardText()}
                onInput={(e) => setHeardText(e.currentTarget.value)}
                rows={3}
              />
              <div class="heard-row">
                <span />
                <button class="confirm" onClick={() => setPhase("heard")}>
                  Submit →
                </button>
              </div>
            </div>
          )}
          {sttSupported() && (
            <button class="link stop" onClick={() => {
              stopListening();
            }}>
              I'm done — show what you heard
            </button>
          )}
        </Show>

        <Show when={phase() === "finalizing"}>
          <div class="listening-note">
            Lumo is reading everything you shared and making your profile…
          </div>
        </Show>

        <Show when={phase() === "error" && errorMsg()}>
          <div class="error">{errorMsg()}</div>
          <button class="confirm" onClick={finalize}>Try again</button>
        </Show>
      </section>

      <footer class="interview-foot">
        <span>Lumo asks real follow-ups. No scoring on screen while you talk.</span>
      </footer>
    </main>
  );
};

function lumoLabel(p: Phase): string {
  switch (p) {
    case "asking": return "speaking";
    case "listening": return "listening";
    case "heard": return "ready";
    case "finalizing": return "thinking";
    case "error": return "stuck";
    default: return "idle";
  }
}

export default Interview;
