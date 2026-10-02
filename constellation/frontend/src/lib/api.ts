import type { Board, BoardInfo, Task, TaskPatch } from "./types";

export const API_BASE = "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export function getBoards(): Promise<BoardInfo[]> {
  return request<BoardInfo[]>("/boards");
}

export async function getTasks(boardId: string): Promise<Task[]> {
  const tasks = await request<Task[] | null>(`/${boardId}/tasks`);
  return tasks ?? [];
}

export function putTask(boardId: string, task: Task): Promise<void> {
  return request<void>(`/${boardId}/tasks`, {
    method: "PUT",
    body: JSON.stringify(task),
  });
}

export function putBoard(board: Board): Promise<void> {
  return request<void>("/boards", {
    method: "PUT",
    body: JSON.stringify(board),
  });
}

export function renameBoard(boardId: string, boardName: string): Promise<BoardInfo> {
  return request<BoardInfo>(`/boards/${boardId}`, {
    method: "PATCH",
    body: JSON.stringify({ board_name: boardName }),
  });
}

export function deleteBoard(boardId: string): Promise<void> {
  return request<void>(`/boards/${boardId}`, { method: "DELETE" });
}

export function patchTask(
  boardId: string,
  taskId: string,
  patch: TaskPatch,
): Promise<Task> {
  return request<Task>(`/${boardId}/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function queryBoard(boardId: string, query: string): Promise<string> {
  const params = new URLSearchParams({ query });
  return request<string>(`/${boardId}/query?${params.toString()}`, {
    method: "PUT",
  });
}
