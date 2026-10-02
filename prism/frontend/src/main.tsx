/* @refresh reload */
import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";

import "./styles/tokens.css";
import "./styles/global.css";

import Welcome from "./routes/Welcome";
import Interview from "./routes/Interview";
import Results from "./routes/Results";

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
