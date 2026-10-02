<script lang="ts">
  import { board } from "../stores/board.svelte";
  import { parsePlannerWorkbook } from "../planner";
  import SidebarItem from "./SidebarItem.svelte";

  let fileInput = $state<HTMLInputElement | null>(null);
  let importing = $state(false);
  let importError = $state<string | null>(null);

  async function onFileChosen(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    importing = true;
    importError = null;
    try {
      const imported = await parsePlannerWorkbook(file);
      await board.importBoard(imported);
    } catch (e) {
      importError = (e as Error).message;
    } finally {
      importing = false;
    }
  }
</script>

<aside class="flex h-full flex-col border-r border-slate-200 bg-slate-50">
  <div class="flex items-center gap-2 px-4 py-4">
    <svg viewBox="0 0 24 24" class="size-6 text-indigo-600" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <circle cx="5" cy="6" r="2" /><circle cx="18" cy="5" r="2" /><circle cx="12" cy="13" r="2" /><circle cx="19" cy="18" r="2" /><circle cx="6" cy="18" r="2" />
      <path d="M6.8 7.2 10.6 11.6M16.4 6.2 13.4 11.4M13.6 14.4 17.4 16.8M10.4 14.4 7.4 16.6" />
    </svg>
    <h1 class="text-lg font-semibold tracking-tight text-slate-900">Constellation</h1>
  </div>

  <div class="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
    Task boards
  </div>

  <nav class="flex-1 overflow-y-auto px-2">
    {#if board.boards.length === 0}
      <p class="px-3 py-2 text-sm text-slate-500">
        {board.loading ? "Loading boards…" : "No boards yet."}
      </p>
    {:else}
      <ul class="space-y-1">
        {#each board.boards as info (info.boardId)}
          <SidebarItem
            boardName={info.boardName}
            selected={info.boardId === board.selectedBoardId}
            onselect={() => board.selectBoard(info.boardId)}
            onrename={(name) => board.renameBoard(info.boardId, name)}
            ondelete={() => board.deleteBoard(info.boardId)}
          />
        {/each}
      </ul>
    {/if}
  </nav>

  <div class="space-y-2 border-t border-slate-200 p-3">
    <input
      bind:this={fileInput}
      type="file"
      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      class="hidden"
      onchange={onFileChosen}
    />
    <button
      type="button"
      disabled={importing}
      onclick={() => fileInput?.click()}
      class="flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      {importing ? "Importing…" : "Import from Planner"}
    </button>
    {#if importError}
      <p class="text-xs text-red-600">{importError}</p>
    {/if}
    {#if board.offline}
      <p class="text-xs text-amber-700">
        Backend offline. Showing sample data; changes won't be saved.
      </p>
    {/if}
  </div>
</aside>
