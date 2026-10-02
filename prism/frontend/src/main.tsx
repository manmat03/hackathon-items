/* @refresh reload */
import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";

import "./styles/tokens.css";
import "./styles/global.css";

import Welcome from "./routes/Welcome";
import Interview from "./routes/Interview";
import Results from "./routes/Results";
import { initLumoVoice } from "./lib/speech";

// Warm the browser's voice list so the first utterance uses the chosen
// voice rather than falling back to whatever happened to load first.
initLumoVoice();

const root = document.getElementById("root")!;

render(
  () => (
    <Router>
      <Route path="/" component={Welcome} />
      <Route path="/interview" component={Interview} />
      <Route path="/results" component={Results} />
    </Router>
  ),
  root
);
