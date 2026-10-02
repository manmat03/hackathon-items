import * as XLSX from "xlsx";
import { parseLocalDate, TaskCertainty, toIsoDate, type Board, type Task } from "./types";

type Row = Record<string, unknown>;

const HEADER_ALIASES = {
  name: ["task name", "title", "name"],
  description: ["description", "notes"],
  due: ["due date", "due", "expected date"],
  progress: ["progress", "status"],
  late: ["late"],
  priority: ["priority"],
} as const;

function normalize(header: string): string {
  return header.trim().toLowerCase();
}

function pick(row: Row, keys: readonly string[]): unknown {
  for (const [header, value] of Object.entries(row)) {
    if (keys.includes(normalize(header))) return value;
  }
  return undefined;
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** Planner exports dates as either Excel serials, JS Dates (with cellDates), or text. */
function toIsoDateOrNull(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return toIsoDate(v);
  if (typeof v === "number") {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) return toIsoDate(new Date(parsed.y, parsed.m - 1, parsed.d));
  }
  const text = asString(v);
  if (!text) return null;
  // Planner writes ISO dates as text; keep them local rather than UTC-shifted.
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return toIsoDate(parseLocalDate(text));
  const d = new Date(text);
  return isNaN(d.getTime()) ? null : toIsoDate(d);
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return toIsoDate(d);
}

function isTruthy(v: unknown): boolean {
  const text = asString(v).toLowerCase();
  return text === "true" || text === "yes" || text === "1";
}

function certaintyFor(row: Row): TaskCertainty {
  const progress = asString(pick(row, HEADER_ALIASES.progress)).toLowerCase();
  if (progress === "completed" || progress === "complete" || progress === "done") {
    return TaskCertainty.HIGH;
  }
  if (isTruthy(pick(row, HEADER_ALIASES.late))) return TaskCertainty.LOW;
  return TaskCertainty.MEDIUM;
}

export function rowsToTasks(rows: Row[]): Task[] {
  const tasks: Task[] = [];
  for (const row of rows) {
    const name = asString(pick(row, HEADER_ALIASES.name));
    if (!name) continue;
    tasks.push({
      task_id: crypto.randomUUID(),
      task_name: name,
      task_description: asString(pick(row, HEADER_ALIASES.description)),
      expected_date: toIsoDateOrNull(pick(row, HEADER_ALIASES.due)) ?? defaultDueDate(),
      certainty: certaintyFor(row),
      parents: [],
      children: [],
    });
  }
  return tasks;
}

function findSheet(workbook: XLSX.WorkBook, name: string): XLSX.WorkSheet | undefined {
  const match = workbook.SheetNames.find((n) => n.toLowerCase() === name.toLowerCase());
  return match ? workbook.Sheets[match] : undefined;
}

/** The "Plan" sheet holds a single metadata row with the plan's display name. */
function planName(workbook: XLSX.WorkBook): string | null {
  const sheet = findSheet(workbook, "Plan");
  if (!sheet) return null;
  const [row] = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
  const name = row ? asString(pick(row, ["plan name", "plan"])) : "";
  return name || null;
}

/**
 * Planner's "Export plan to Excel" produces a workbook with "Plan", "Tasks",
 * "Buckets", "Users", ... sheets. Tasks live on the "Tasks" sheet as a header
 * row followed by one row per task.
 */
export async function parsePlannerWorkbook(file: File): Promise<Board> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  const sheet =
    findSheet(workbook, "Tasks") ??
    findSheet(workbook, "Consolidated Data") ??
    workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Workbook has no sheets");

  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
  const tasks = rowsToTasks(rows);
  if (tasks.length === 0) {
    throw new Error('No tasks found. Expected a "Tasks" sheet with a "Task Name" column.');
  }

  return {
    board_id: crypto.randomUUID(),
    board_name:
      planName(workbook) ?? (file.name.replace(/\.[^.]+$/, "") || "Imported plan"),
    board_tasks: tasks,
  };
}
