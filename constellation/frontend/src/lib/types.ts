export interface BoardInfo {
  boardId: string;
  boardName: string;
}

export enum TaskCertainty {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export interface Task {
  task_id: string;
  task_name: string;
  task_description: string;
  /** ISO date, YYYY-MM-DD (matches the FastAPI `date` serialization) */
  expected_date: string;
  certainty: TaskCertainty;
  parents: string[];
  children: string[];
}

export type TaskPatch = Partial<Omit<Task, "task_id">>;

export interface Board {
  board_id: string;
  board_name: string;
  board_tasks: Task[];
}

export interface Position {
  x: number;
  y: number;
}

export type DueStatus = "overdue" | "soon" | "ok";

const MS_PER_DAY = 86_400_000;

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Parse YYYY-MM-DD as a local date (avoids the UTC shift of `new Date(str)`). */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysUntil(task: Pick<Task, "expected_date">): number {
  const due = parseLocalDate(task.expected_date).getTime();
  return Math.round((due - startOfToday()) / MS_PER_DAY);
}

export function dueStatus(task: Pick<Task, "expected_date">): DueStatus {
  const days = daysUntil(task);
  if (days < 0) return "overdue";
  if (days <= 2) return "soon";
  return "ok";
}

export function formatDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
