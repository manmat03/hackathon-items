import { TaskCertainty, toIsoDate, type Board } from "./types";

export const SAMPLE_BOARD_ID = "sample-board";

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** Local fallback used when the backend is unreachable or has no boards. */
export function makeSampleBoard(): Board {
  const kickoff = "sample-kickoff";
  const design = "sample-design";
  const backend = "sample-backend";
  const frontend = "sample-frontend";
  const demo = "sample-demo";

  return {
    board_id: SAMPLE_BOARD_ID,
    board_name: "Sample: Hackathon",
    board_tasks: [
      {
        task_id: kickoff,
        task_name: "Project kickoff",
        task_description: "Agree on scope, split up work, and set up the repo.",
        expected_date: daysFromNow(-3),
        certainty: TaskCertainty.HIGH,
        parents: [],
        children: [design],
      },
      {
        task_id: design,
        task_name: "Write design doc",
        task_description:
          "Document the API contract, task model, and the UI layout for the board view.",
        expected_date: daysFromNow(-1),
        certainty: TaskCertainty.HIGH,
        parents: [kickoff],
        children: [backend, frontend],
      },
      {
        task_id: backend,
        task_name: "Build FastAPI backend",
        task_description:
          "Boards and tasks endpoints backed by a polars table, plus the PM assistant query endpoint.",
        expected_date: daysFromNow(1),
        certainty: TaskCertainty.MEDIUM,
        parents: [design],
        children: [demo],
      },
      {
        task_id: frontend,
        task_name: "Build Svelte frontend",
        task_description:
          "Board sidebar, draggable task graph, task detail view, and Planner import.",
        expected_date: daysFromNow(2),
        certainty: TaskCertainty.LOW,
        parents: [design],
        children: [demo],
      },
      {
        task_id: demo,
        task_name: "Demo to judges",
        task_description: "Five minute walkthrough of the board and the assistant.",
        expected_date: daysFromNow(7),
        certainty: TaskCertainty.MEDIUM,
        parents: [backend, frontend],
        children: [],
      },
    ],
  };
}
