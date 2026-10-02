import * as api from "../api";
import { makeSampleBoard, SAMPLE_BOARD_ID } from "../sample";
import type { Board, BoardInfo, Position, Task, TaskPatch } from "../types";

export const CARD_WIDTH = 208;
export const CARD_HEIGHT = 96;
const COLUMN_GAP = 260;
const ROW_GAP = 140;
const CANVAS_PADDING = 40;

class BoardStore {
  boards = $state<BoardInfo[]>([]);
  selectedBoardId = $state<string | null>(null);
  tasks = $state<Task[]>([]);
  positions = $state<Record<string, Position>>({});
  detailTaskId = $state<string | null>(null);
  connectFromId = $state<string | null>(null);
  showNewTask = $state(false);
  loading = $state(false);
  error = $state<string | null>(null);
  /** True when the backend could not be reached; edits stay in memory. */
  offline = $state(false);

  private sampleBoard: Board | null = null;

  selectedBoard = $derived(
    this.boards.find((b) => b.boardId === this.selectedBoardId) ?? null,
  );
  detailTask = $derived(this.taskById(this.detailTaskId));

  taskById(id: string | null | undefined): Task | null {
    if (!id) return null;
    return this.tasks.find((t) => t.task_id === id) ?? null;
  }

  async loadBoards(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const boards = await api.getBoards();
      this.offline = false;
      if (boards.length === 0) {
        this.useSampleBoard();
      } else {
        this.boards = boards;
      }
    } catch (e) {
      console.warn("Backend unreachable, using sample data", e);
      this.offline = true;
      this.useSampleBoard();
    } finally {
      this.loading = false;
    }

    if (!this.selectedBoardId && this.boards.length > 0) {
      await this.selectBoard(this.boards[0].boardId);
    }
  }

  private useSampleBoard(): void {
    this.sampleBoard ??= makeSampleBoard();
    this.boards = [
      { boardId: this.sampleBoard.board_id, boardName: this.sampleBoard.board_name },
    ];
  }

  async selectBoard(boardId: string): Promise<void> {
    if (boardId === this.selectedBoardId) return;
    this.selectedBoardId = boardId;
    this.detailTaskId = null;
    this.connectFromId = null;
    this.loading = true;
    this.error = null;
    try {
      if (boardId === SAMPLE_BOARD_ID && this.sampleBoard) {
        this.tasks = structuredClone(this.sampleBoard.board_tasks);
      } else {
        this.tasks = await api.getTasks(boardId);
      }
      this.positions = layoutTasks(this.tasks);
    } catch (e) {
      this.error = `Could not load tasks: ${(e as Error).message}`;
      this.tasks = [];
      this.positions = {};
    } finally {
      this.loading = false;
    }
  }

  private get isLocalOnly(): boolean {
    return this.offline || this.selectedBoardId === SAMPLE_BOARD_ID;
  }

  async renameBoard(boardId: string, boardName: string): Promise<void> {
    const name = boardName.trim();
    const info = this.boards.find((b) => b.boardId === boardId);
    if (!info || !name || name === info.boardName) return;
    try {
      if (!this.offline && boardId !== SAMPLE_BOARD_ID) {
        await api.renameBoard(boardId, name);
      }
      info.boardName = name;
      if (this.sampleBoard?.board_id === boardId) this.sampleBoard.board_name = name;
    } catch (e) {
      this.error = `Could not rename board: ${(e as Error).message}`;
    }
  }

  async deleteBoard(boardId: string): Promise<void> {
    try {
      if (!this.offline && boardId !== SAMPLE_BOARD_ID) {
        await api.deleteBoard(boardId);
      }
      this.boards = this.boards.filter((b) => b.boardId !== boardId);
      if (this.selectedBoardId === boardId) {
        this.selectedBoardId = null;
        this.tasks = [];
        this.positions = {};
        this.detailTaskId = null;
        this.connectFromId = null;
        if (this.boards.length > 0) await this.selectBoard(this.boards[0].boardId);
      }
    } catch (e) {
      this.error = `Could not delete board: ${(e as Error).message}`;
    }
  }

  moveTask(taskId: string, pos: Position): void {
    this.positions[taskId] = pos;
  }

  async addTask(task: Task, parentId?: string): Promise<void> {
    if (!this.selectedBoardId) return;
    if (parentId) task.parents = [parentId];

    if (!this.isLocalOnly) {
      await api.putTask(this.selectedBoardId, task);
    }
    this.tasks.push(task);
    this.positions[task.task_id] = this.placeNewTask(parentId);

    if (parentId) {
      await this.applyPatch(parentId, {
        children: unique([...(this.taskById(parentId)?.children ?? []), task.task_id]),
      });
    }
  }

  private placeNewTask(parentId?: string): Position {
    const parent = parentId ? this.positions[parentId] : undefined;
    if (parent) {
      const siblings = this.tasks.filter((t) => t.parents.includes(parentId!)).length;
      return { x: parent.x + COLUMN_GAP, y: parent.y + (siblings - 1) * ROW_GAP };
    }
    const maxY = Math.max(CANVAS_PADDING - ROW_GAP, ...Object.values(this.positions).map((p) => p.y));
    return { x: CANVAS_PADDING, y: maxY + ROW_GAP };
  }

  startConnect(taskId: string): void {
    this.connectFromId = this.connectFromId === taskId ? null : taskId;
  }

  cancelConnect(): void {
    this.connectFromId = null;
  }

  /** Complete a pending connection: `connectFromId` becomes a parent of `childId`. */
  async finishConnect(childId: string): Promise<void> {
    const parentId = this.connectFromId;
    this.connectFromId = null;
    if (!parentId || parentId === childId) return;
    await this.connect(parentId, childId);
  }

  async connect(parentId: string, childId: string): Promise<void> {
    const parent = this.taskById(parentId);
    const child = this.taskById(childId);
    if (!parent || !child) return;
    if (parent.children.includes(childId)) return;
    if (createsCycle(this.tasks, parentId, childId)) {
      this.error = "That connection would create a cycle.";
      return;
    }
    await this.applyPatch(parentId, { children: [...parent.children, childId] });
    await this.applyPatch(childId, { parents: [...child.parents, parentId] });
  }

  async disconnect(parentId: string, childId: string): Promise<void> {
    const parent = this.taskById(parentId);
    const child = this.taskById(childId);
    if (!parent || !child) return;
    await this.applyPatch(parentId, {
      children: parent.children.filter((id) => id !== childId),
    });
    await this.applyPatch(childId, {
      parents: child.parents.filter((id) => id !== parentId),
    });
  }

  async applyPatch(taskId: string, patch: TaskPatch): Promise<void> {
    const task = this.taskById(taskId);
    if (!task || !this.selectedBoardId) return;
    try {
      if (!this.isLocalOnly) {
        await api.patchTask(this.selectedBoardId, taskId, patch);
      }
      Object.assign(task, patch);
    } catch (e) {
      this.error = `Could not save task: ${(e as Error).message}`;
    }
  }

  async importBoard(board: Board): Promise<void> {
    this.error = null;
    if (this.offline) {
      this.boards.push({ boardId: board.board_id, boardName: board.board_name });
      this.selectedBoardId = board.board_id;
      this.tasks = board.board_tasks;
      this.positions = layoutTasks(this.tasks);
      return;
    }
    await api.putBoard(board);
    this.boards = await api.getBoards();
    this.selectedBoardId = null;
    await this.selectBoard(board.board_id);
  }

  openDetail(taskId: string): void {
    this.detailTaskId = taskId;
  }

  closeDetail(): void {
    this.detailTaskId = null;
  }

  clearError(): void {
    this.error = null;
  }
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

/** Longest-path depth from any root, with a visited guard against cycles. */
function computeDepths(tasks: Task[]): Map<string, number> {
  const byId = new Map(tasks.map((t) => [t.task_id, t]));
  const depths = new Map<string, number>();

  const depthOf = (id: string, trail: Set<string>): number => {
    const cached = depths.get(id);
    if (cached !== undefined) return cached;
    const task = byId.get(id);
    if (!task || trail.has(id)) return 0;
    trail.add(id);
    const parents = task.parents.filter((p) => byId.has(p));
    const depth =
      parents.length === 0 ? 0 : 1 + Math.max(...parents.map((p) => depthOf(p, trail)));
    trail.delete(id);
    depths.set(id, depth);
    return depth;
  };

  for (const t of tasks) depthOf(t.task_id, new Set());
  return depths;
}

export function layoutTasks(tasks: Task[]): Record<string, Position> {
  const depths = computeDepths(tasks);
  const columns = new Map<number, Task[]>();
  for (const t of tasks) {
    const d = depths.get(t.task_id) ?? 0;
    columns.set(d, [...(columns.get(d) ?? []), t]);
  }
  const positions: Record<string, Position> = {};
  for (const [depth, col] of columns) {
    col
      .sort((a, b) => a.expected_date.localeCompare(b.expected_date))
      .forEach((t, row) => {
        positions[t.task_id] = {
          x: CANVAS_PADDING + depth * COLUMN_GAP,
          y: CANVAS_PADDING + row * ROW_GAP,
        };
      });
  }
  return positions;
}

function createsCycle(tasks: Task[], parentId: string, childId: string): boolean {
  const byId = new Map(tasks.map((t) => [t.task_id, t]));
  const stack = [childId];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (id === parentId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(byId.get(id)?.children ?? []));
  }
  return false;
}

export const board = new BoardStore();
