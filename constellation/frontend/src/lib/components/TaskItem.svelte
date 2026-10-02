<script lang="ts">
  import { board, CARD_HEIGHT, CARD_WIDTH } from "../stores/board.svelte";
  import { daysUntil, dueStatus, formatDate, type Task } from "../types";

  interface Props {
    task: Task;
  }

  let { task }: Props = $props();

  const DRAG_THRESHOLD = 4;

  let dragging = $state(false);
  let dragStart: { px: number; py: number; x: number; y: number } | null = null;
  let moved = false;

  let pos = $derived(board.positions[task.task_id] ?? { x: 0, y: 0 });
  let status = $derived(dueStatus(task));
  let days = $derived(daysUntil(task));
  let isSource = $derived(board.connectFromId === task.task_id);
  let isTarget = $derived(board.connectFromId !== null && !isSource);
  let isSelected = $derived(board.detailTaskId === task.task_id);

  const palette = {
    overdue: "bg-red-50 border-red-400 text-red-950 hover:border-red-500",
    soon: "bg-amber-50 border-amber-400 text-amber-950 hover:border-amber-500",
    ok: "bg-emerald-50 border-emerald-400 text-emerald-950 hover:border-emerald-500",
  } as const;

  const stripe = {
    overdue: "bg-red-500",
    soon: "bg-amber-400",
    ok: "bg-emerald-500",
  } as const;

  const certaintyBadge = {
    LOW: "bg-rose-100 text-rose-700",
    MEDIUM: "bg-sky-100 text-sky-700",
    HIGH: "bg-emerald-100 text-emerald-700",
  } as const;

  let dueLabel = $derived.by(() => {
    if (days < 0) return `${-days}d overdue`;
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `Due in ${days}d`;
  });

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-no-drag]")) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragStart = { px: event.clientX, py: event.clientY, x: pos.x, y: pos.y };
    moved = false;
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragStart) return;
    const dx = event.clientX - dragStart.px;
    const dy = event.clientY - dragStart.py;
    if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    moved = true;
    dragging = true;
    board.moveTask(task.task_id, {
      x: Math.max(0, dragStart.x + dx),
      y: Math.max(0, dragStart.y + dy),
    });
  }

  function onPointerUp(event: PointerEvent) {
    if (!dragStart) return;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    dragStart = null;
    dragging = false;
    if (!moved && isTarget) {
      board.finishConnect(task.task_id);
    }
  }

  function onDoubleClick() {
    if (board.connectFromId) return;
    board.openDetail(task.task_id);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      if (isTarget) board.finishConnect(task.task_id);
      else board.openDetail(task.task_id);
    }
  }
</script>

<div
  role="button"
  tabindex="0"
  aria-label="{task.task_name}, {dueLabel}"
  class="group absolute flex select-none flex-col overflow-hidden rounded-lg border-2 shadow-sm transition-[box-shadow,border-color] {palette[status]}
    {dragging ? 'z-20 cursor-grabbing shadow-xl' : 'cursor-grab hover:shadow-md'}
    {isSource ? 'ring-4 ring-indigo-400/60' : ''}
    {isTarget ? 'cursor-crosshair ring-2 ring-indigo-300/60 ring-offset-1' : ''}
    {isSelected ? 'ring-2 ring-slate-500' : ''}"
  style="left: {pos.x}px; top: {pos.y}px; width: {CARD_WIDTH}px; height: {CARD_HEIGHT}px;"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  ondblclick={onDoubleClick}
  onkeydown={onKeyDown}
>
  <div class="h-1.5 w-full {stripe[status]}"></div>
  <div class="flex flex-1 flex-col justify-between p-2.5">
    <div class="line-clamp-2 text-sm font-semibold leading-snug">{task.task_name}</div>
    <div class="flex items-end justify-between gap-2 text-xs">
      <div class="min-w-0">
        <div class="truncate font-medium">{formatDate(task.expected_date)}</div>
        <div class="truncate opacity-70">{dueLabel}</div>
      </div>
      <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide {certaintyBadge[task.certainty]}">
        {task.certainty}
      </span>
    </div>
  </div>

  <button
    type="button"
    data-no-drag
    title={isSource ? "Cancel connection" : "Connect to another task"}
    aria-label={isSource ? "Cancel connection" : "Connect to another task"}
    onclick={(e) => {
      e.stopPropagation();
      board.startConnect(task.task_id);
    }}
    class="absolute -right-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white shadow transition
      {isSource ? 'scale-110 opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}"
  >
    <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {#if isSource}
        <path d="M6 6l12 12M18 6 6 18" />
      {:else}
        <path d="M5 12h14m-6-6 6 6-6 6" />
      {/if}
    </svg>
  </button>
</div>
