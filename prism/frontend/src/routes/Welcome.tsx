import { Component } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Lumo } from "../components/Lumo";
import { setTranscript, setResult } from "../lib/store";
import { ttsSupported, sttSupported } from "../lib/speech";
import "./Welcome.css";

const Welcome: Component = () => {
  const nav = useNavigate();
  const canVoice = ttsSupported() && sttSupported();

  const begin = () => {
    setTranscript([]);
    setResult(null);
    nav("/interview");
  };

  return (
    <main class="welcome">
      <div class="welcome-mast">
        <div class="word">
          Prism<span class="dot" aria-hidden="true" />
        </div>
        <div class="welcome-tag">A conversation with Lumo · about 10 minutes</div>
      </div>

      <section class="welcome-stage">
        <Lumo state="idle" size={160} label="Lumo" />

        <h1 class="welcome-title">
          Tell me about your work. I'll listen, and we'll make a reading together.
        </h1>

        <p class="welcome-lede">
          Lumo asks a handful of real questions. You answer in your own words.
          Nothing is scored on screen while you talk. At the end you'll see a
          short reading on your fourteen skill areas.
        </p>

        <button class="welcome-cta" onClick={begin}>
          Begin
        </button>

        {!canVoice && (
          <p class="welcome-note">
            Heads up: this browser doesn't support voice input. You can still
            type your answers each turn.
          </p>
        )}
      </section>

      <footer class="welcome-foot">
        Local only · nothing leaves this machine except the final submission
        to your own backend.
      </footer>
    </main>
  );
};

export default Welcome;
