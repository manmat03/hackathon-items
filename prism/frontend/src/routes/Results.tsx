import { Component, createMemo, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { ALL_SKILLS, SKILL_SHORT, type Skill } from "../lib/types";
import { result } from "../lib/store";
import "./Results.css";

const Results: Component = () => {
  const nav = useNavigate();

  // Build an ordered 14-row view, filling missing skills with 0 for safety.
  const rows = createMemo<Skill[]>(() => {
    const data = result();
    if (!data) return [];
    const byName = new Map(data.skills.map((s) => [s.name, s]));
    return ALL_SKILLS.map(
      (name) => byName.get(name) ?? { name, score: 0 }
    );
  });

  const peakIndex = createMemo(() => {
    const r = rows();
    if (r.length === 0) return -1;
    let maxI = 0;
    for (let i = 1; i < r.length; i++) {
      if (r[i].score > r[maxI].score) maxI = i;
    }
    return maxI;
  });

  const lead = createMemo(() => {
    const r = rows();
    const i = peakIndex();
    return i >= 0 ? r[i] : null;
  });

  const strong = createMemo(() =>
    rows().filter((s) => s.score >= 3)
  );

  const execSummary = createMemo(() => {
    const l = lead();
    const s = strong();
    if (!l) return "No reading yet.";
    if (s.length === 0) {
      return `Early in the arc. Clearest signal today is ${l.name}; the rest will come with more engagements.`;
    }
    const strongNames = s
      .slice(0, 3)
      .map((x) => x.name)
      .join(", ");
    return `Specialist in ${strongNames}. ${l.name} is the strongest signal (${l.score.toFixed(1)} / 5). Thrives on hands-on building; staff them next on anything shipping fast.`;
  });

  return (
    <main class="results">
      <header class="navy-band">
        <div class="word light">
          Prism<span class="dot" aria-hidden="true" />
        </div>
        <div class="mid light">Morning note · For staffing use</div>
        <div class="right light">
          <b>Reading complete</b>
          <br />
          {new Date().toLocaleDateString(undefined, {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </div>
      </header>

      <Show
        when={result()}
        fallback={
          <section class="empty">
            <h2>No reading yet.</h2>
            <p>Finish an interview first — Lumo makes the reading when you do.</p>
            <button class="confirm" onClick={() => nav("/")}>Begin</button>
          </section>
        }
      >
        <section class="results-stage">
          <h1 class="title">
            A reading on <b>you</b>, after a short conversation with Lumo.
          </h1>

          <p class="exec">{execSummary()}</p>

          <div class="chart">
            <div class="pills" aria-hidden="true">
              {rows().map((skill, i) => {
                const h = Math.max((skill.score / 5) * 100, 4);
                const classes =
                  i === peakIndex() ? "pill peak" : skill.score >= 3 ? "pill lit" : "pill";
                return (
                  <div class={classes} style={{ height: `${h}%` }} />
                );
              })}
            </div>
            <div class="pill-labels" aria-hidden="true">
              {rows().map((skill, i) => (
                <span class={i === peakIndex() ? "peak-label" : skill.score >= 3 ? "lit-label" : ""}>
                  {SKILL_SHORT[skill.name]}
                </span>
              ))}
            </div>
          </div>

          <section class="aside">
            <div>
              <h5>Where they shine</h5>
              <p>{lead() ? `${lead()!.name}, carried through hands-on building.` : "—"}</p>
            </div>
            <div>
              <h5>Where they'd grow</h5>
              <p class="placeholder">
                Backend doesn't yet produce a work-style profile — this block
                will land in the full version. For now, pair the lead skill
                with one adjacent area to round out the arc.
              </p>
            </div>
            <div>
              <h5>Where they'd dim</h5>
              <p class="placeholder">
                Placeholder — the staffing summary and "avoid" guidance come
                from the Lumo conversation agent, not yet wired. The scores
                above are real.
              </p>
            </div>
          </section>

          <div class="results-foot">
            <button class="link" onClick={() => nav("/")}>Begin a new reading</button>
          </div>
        </section>
      </Show>
    </main>
  );
};

export default Results;
