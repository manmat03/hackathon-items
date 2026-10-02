<script lang="ts">
  import { board, CARD_HEIGHT, CARD_WIDTH } from "../stores/board.svelte";
  import TaskItem from "./TaskItem.svelte";

  const PADDING = 120;

  interface Edge {
    key: string;
    parentId: string;
    childId: string;
    path: string;
    midX: number;
    midY: number;
  }

  let edges = $derived.by<Edge[]>(() => {
    const ids = new Set(board.tasks.map((t) => t.task_id));
    const out: Edge[] = [];
    for (const parent of board.tasks) {
      const from = board.positions[parent.task_id];
      if (!from) continue;
      for (const childId of parent.children) {
        if (!ids.has(childId)) continue;
        const to = board.positions[childId];
        if (!to) continue;
        const x1 = from.x + CARD_WIDTH;
        const y1 = from.y + CARD_HEIGHT / 2;
        const x2 = to.x;
        const y2 = to.y + CARD_HEIGHT / 2;
        const bend = Math.max(40, Math.abs(x2 - x1) / 2);
        out.push({
          key: `${parent.task_id}->${childId}`,
          parentId: parent.task_id,
          childId,
          path: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
          midX: (x1 + x2) / 2,
          midY: (y1 + y2) / 2,
        });
      }
    }
    return out;
  });

  let canvasSize = $derived.by(() => {
    let w = 0;
    let h = 0;
    for (const p of Object.values(board.positions)) {
      w = Math.max(w, p.x + CARD_WIDTH);
      h = Math.max(h, p.y + CARD_HEIGHT);
    }
    return { width: w + PADDING, height: h + PADDING };
  });

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      board.cancelConnect();
      board.closeDetail();
    }
  }

  function onBackgroundClick(event: MouseEvent) {
    if (event.target === event.currentTarget) board.cancelConnect();
  }
</script>

<svelte:window onkeydown={onKeyDown} />

<section class="relative flex h-full min-h-0 flex-col bg-white">
  {#if board.connectFromId}
    <div class="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center">
      <div class="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-lg">
        Click another task to make it flow from
        <span class="font-semibold">{board.taskById(board.connectFromId)?.task_name}</span>
        · Esc to cancel
      </div>
    </div>
  {/if}

  {#if board.error}
    <div class="absolute inset-x-0 bottom-3 z-30 flex justify-center">
      <div class="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 shadow">
        {board.error}
        <button type="button" class="font-semibold hover:underline" onclick={() => board.clearError()}>
          Dismiss
        </button>
      </div>
    </div>
  {/if}

  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="flex-1 overflow-auto bg-[radial-gradient(circle,_#cbd5e1_1px,_transparent_1px)] bg-[length:24px_24px]"
    onclick={onBackgroundClick}
  >
    {#if board.loading && board.tasks.length === 0}
      <p class="p-8 text-sm text-slate-500">Loading tasks…</p>
    {:else if board.tasks.length === 0}
      <div class="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
        <p class="text-base font-medium">This board is empty.</p>
        <p class="text-sm">Add a task with the button above to get started.</p>
      </div>
    {:else}
      <div class="relative" style="width: {canvasSize.width}px; height: {canvasSize.height}px;">
        <svg class="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 0 L 10 5 L 0 10 z" class="fill-slate-400" />
            </marker>
          </defs>
          {#each edges as edge (edge.key)}
            <g class="group pointer-events-auto cursor-pointer">
              <path d={edge.path} class="fill-none stroke-transparent" stroke-width="14" />
              <path
                d={edge.path}
                class="fill-none stroke-slate-400 transition-colors group-hover:stroke-red-400"
                stroke-width="2"
                marker-end="url(#arrowhead)"
              />
              <g
                class="opacity-0 transition-opacity group-hover:opacity-100"
                role="button"
                tabindex="-1"
                aria-label="Remove connection"
                onclick={(e) => {
                  e.stopPropagation();
                  board.disconnect(edge.parentId, edge.childId);
                }}
                onkeydown={() => {}}
              >
                <circle cx={edge.midX} cy={edge.midY} r="9" class="fill-white stroke-red-400" stroke-width="1.5" />
                <path
                  d="M {edge.midX - 3.5} {edge.midY - 3.5} l 7 7 m 0 -7 l -7 7"
                  class="stroke-red-500"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
              </g>
            </g>
          {/each}
        </svg>

        {#each board.tasks as task (task.task_id)}
          <TaskItem {task} />
        {/each}
      </div>
    {/if}
  </div>
</section>
