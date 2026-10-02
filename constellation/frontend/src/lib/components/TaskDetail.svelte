<script lang="ts">
  import { board } from "../stores/board.svelte";
  import { dueStatus, formatDate, type Task } from "../types";
  import Modal from "./Modal.svelte";

  interface Props {
    task: Task;
  }

  let { task }: Props = $props();

  let parents = $derived(
    task.parents.map((id) => board.taskById(id)).filter((t): t is Task => t !== null),
  );
  let children = $derived(
    task.children.map((id) => board.taskById(id)).filter((t): t is Task => t !== null),
  );
  let status = $derived(dueStatus(task));

  const statusChip = {
    overdue: "bg-red-100 text-red-800",
    soon: "bg-amber-100 text-amber-800",
    ok: "bg-emerald-100 text-emerald-800",
  } as const;

  const statusText = {
    overdue: "Overdue",
    soon: "Due soon",
    ok: "On track",
  } as const;
</script>

{#snippet relatedList(label: string, items: Task[])}
  <div>
    <h3 class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h3>
    {#if items.length === 0}
      <p class="text-sm text-slate-400">None</p>
    {:else}
      <ul class="space-y-1">
        {#each items as related (related.task_id)}
          <li>
            <button
              type="button"
              onclick={() => board.openDetail(related.task_id)}
              class="flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-left text-sm transition hover:border-indigo-300 hover:bg-indigo-50"
            >
              <span class="truncate font-medium text-slate-800">{related.task_name}</span>
              <span class="shrink-0 text-xs text-slate-500">{formatDate(related.expected_date)}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/snippet}

<Modal title={task.task_name} onclose={() => board.closeDetail()}>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center gap-2 text-sm">
      <span class="rounded-full px-2.5 py-0.5 font-medium {statusChip[status]}">{statusText[status]}</span>
      <span class="text-slate-600">Expected {formatDate(task.expected_date)}</span>
      <span class="text-slate-300">·</span>
      <span class="text-slate-600">
        <span class="font-medium">{task.certainty}</span> certainty
      </span>
    </div>

    <div>
      <h3 class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Description</h3>
      {#if task.task_description.trim()}
        <p class="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{task.task_description}</p>
      {:else}
        <p class="text-sm text-slate-400">No description.</p>
      {/if}
    </div>

    <div class="grid grid-cols-2 gap-4">
      {@render relatedList("Flows from", parents)}
      {@render relatedList("Flows to", children)}
    </div>
  </div>
</Modal>
