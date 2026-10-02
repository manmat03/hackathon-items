<script lang="ts">
  import { board } from "../stores/board.svelte";
  import { TaskCertainty, toIsoDate, type Task } from "../types";
  import Modal from "./Modal.svelte";

  const defaultDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toIsoDate(d);
  };

  let name = $state("");
  let description = $state("");
  let expectedDate = $state(defaultDate());
  let certainty = $state<TaskCertainty>(TaskCertainty.MEDIUM);
  let parentId = $state("");
  let saving = $state(false);
  let error = $state<string | null>(null);

  const inputClass =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) {
      error = "Give the task a name.";
      return;
    }
    saving = true;
    error = null;
    const task: Task = {
      task_id: crypto.randomUUID(),
      task_name: name.trim(),
      task_description: description.trim(),
      expected_date: expectedDate,
      certainty,
      parents: [],
      children: [],
    };
    try {
      await board.addTask(task, parentId || undefined);
      board.showNewTask = false;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      saving = false;
    }
  }
</script>

<Modal title="New task" onclose={() => (board.showNewTask = false)}>
  <form id="new-task-form" class="space-y-4" onsubmit={submit}>
    <label class="block">
      <span class="mb-1 block text-sm font-medium text-slate-700">Name</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={name} autofocus required class={inputClass} placeholder="Ship the thing" />
    </label>

    <label class="block">
      <span class="mb-1 block text-sm font-medium text-slate-700">Description</span>
      <textarea bind:value={description} rows="3" class={inputClass} placeholder="What does done look like?"></textarea>
    </label>

    <div class="grid grid-cols-2 gap-4">
      <label class="block">
        <span class="mb-1 block text-sm font-medium text-slate-700">Expected date</span>
        <input type="date" bind:value={expectedDate} required class={inputClass} />
      </label>
      <label class="block">
        <span class="mb-1 block text-sm font-medium text-slate-700">Certainty</span>
        <select bind:value={certainty} class={inputClass}>
          <option value={TaskCertainty.LOW}>Low</option>
          <option value={TaskCertainty.MEDIUM}>Medium</option>
          <option value={TaskCertainty.HIGH}>High</option>
        </select>
      </label>
    </div>

    {#if board.tasks.length > 0}
      <label class="block">
        <span class="mb-1 block text-sm font-medium text-slate-700">Flows from (optional)</span>
        <select bind:value={parentId} class={inputClass}>
          <option value="">No parent</option>
          {#each board.tasks as t (t.task_id)}
            <option value={t.task_id}>{t.task_name}</option>
          {/each}
        </select>
      </label>
    {/if}

    {#if error}
      <p class="text-sm text-red-600">{error}</p>
    {/if}
  </form>

  {#snippet footer()}
    <button
      type="button"
      onclick={() => (board.showNewTask = false)}
      class="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
    >
      Cancel
    </button>
    <button
      type="submit"
      form="new-task-form"
      disabled={saving}
      class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
    >
      {saving ? "Saving…" : "Create task"}
    </button>
  {/snippet}
</Modal>
