<script lang="ts">
  import { onMount } from "svelte";
  import AssistantPanel from "./lib/components/AssistantPanel.svelte";
  import NewTaskForm from "./lib/components/NewTaskForm.svelte";
  import Sidebar from "./lib/components/Sidebar.svelte";
  import TaskBoard from "./lib/components/TaskBoard.svelte";
  import TaskDetail from "./lib/components/TaskDetail.svelte";
  import { board } from "./lib/stores/board.svelte";

  onMount(() => {
    board.loadBoards();
  });

  let legend = [
    { label: "Overdue", cls: "bg-red-500" },
    { label: "Due within 2 days", cls: "bg-amber-400" },
    { label: "On track", cls: "bg-emerald-500" },
  ];
</script>

<div class="grid h-screen grid-cols-[16rem_minmax(0,1fr)_20rem] overflow-hidden text-slate-900">
  <Sidebar />

  <main class="flex min-h-0 flex-col">
    <header class="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3">
      <div class="min-w-0">
        <h2 class="truncate text-base font-semibold">
          {board.selectedBoard?.boardName ?? "Select a board"}
        </h2>
        <p class="text-xs text-slate-500">
          {board.tasks.length} {board.tasks.length === 1 ? "task" : "tasks"} · drag to arrange, double-click for details
        </p>
      </div>

      <div class="flex items-center gap-4">
        <ul class="hidden items-center gap-3 text-xs text-slate-600 lg:flex">
          {#each legend as item}
            <li class="flex items-center gap-1.5">
              <span class="size-2.5 rounded-full {item.cls}"></span>
              {item.label}
            </li>
          {/each}
        </ul>
        <button
          type="button"
          disabled={!board.selectedBoardId}
          onclick={() => (board.showNewTask = true)}
          class="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New task
        </button>
      </div>
    </header>

    <TaskBoard />
  </main>

  <AssistantPanel />
</div>

{#if board.detailTask}
  {#key board.detailTask.task_id}
    <TaskDetail task={board.detailTask} />
  {/key}
{/if}

{#if board.showNewTask}
  <NewTaskForm />
{/if}
