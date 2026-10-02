<script lang="ts">
  import { tick } from "svelte";

  interface Props {
    boardName: string;
    selected: boolean;
    onselect: () => void;
    onrename: (name: string) => Promise<void> | void;
    ondelete: () => Promise<void> | void;
  }

  let { boardName, selected, onselect, onrename, ondelete }: Props = $props();

  let editing = $state(false);
  let draft = $state("");
  let busy = $state(false);
  let input = $state<HTMLInputElement | null>(null);

  async function startEditing(event: MouseEvent) {
    event.stopPropagation();
    draft = boardName;
    editing = true;
    await tick();
    input?.focus();
    input?.select();
  }

  async function commit() {
    if (!editing) return;
    const name = draft.trim();
    editing = false;
    if (!name || name === boardName) return;
    busy = true;
    try {
      await onrename(name);
    } finally {
      busy = false;
    }
  }

  function cancel() {
    editing = false;
  }

  function onInputKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }

  async function remove(event: MouseEvent) {
    event.stopPropagation();
    if (!confirm(`Delete board "${boardName}" and all of its tasks?`)) return;
    busy = true;
    try {
      await ondelete();
    } finally {
      busy = false;
    }
  }

  const iconButton =
    "flex size-6 items-center justify-center rounded transition focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400";
</script>

<li class="group relative">
  {#if editing}
    <form
      class="flex items-center gap-1 rounded-md bg-white px-2 py-1 ring-2 ring-indigo-400"
      onsubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      <input
        bind:this={input}
        bind:value={draft}
        onkeydown={onInputKeyDown}
        onblur={commit}
        aria-label="Board name"
        class="min-w-0 flex-1 bg-transparent py-1 text-sm text-slate-900 focus:outline-none"
      />
      <button type="submit" class="{iconButton} text-emerald-600 hover:bg-emerald-50" aria-label="Save name" title="Save">
        <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M5 12l5 5L20 7" />
        </svg>
      </button>
      <button
        type="button"
        onmousedown={(e) => e.preventDefault()}
        onclick={cancel}
        class="{iconButton} text-slate-500 hover:bg-slate-100"
        aria-label="Cancel rename"
        title="Cancel"
      >
        <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </form>
  {:else}
    <button
      type="button"
      onclick={onselect}
      disabled={busy}
      aria-current={selected ? "page" : undefined}
      class="flex w-full items-center gap-2 rounded-md py-2 pl-3 pr-16 text-left text-sm transition-colors disabled:opacity-60
        {selected
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'text-slate-700 hover:bg-slate-200/70'}"
    >
      <span
        class="size-2 shrink-0 rounded-full {selected ? 'bg-white' : 'bg-indigo-400'}"
        aria-hidden="true"
      ></span>
      <span class="truncate">{boardName}</span>
    </button>

    <div
      class="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
    >
      <button
        type="button"
        onclick={startEditing}
        disabled={busy}
        class="{iconButton} {selected ? 'text-indigo-100 hover:bg-indigo-500 hover:text-white' : 'text-slate-500 hover:bg-slate-300/70 hover:text-slate-800'}"
        aria-label="Rename board {boardName}"
        title="Rename"
      >
        <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button
        type="button"
        onclick={remove}
        disabled={busy}
        class="{iconButton} {selected ? 'text-indigo-100 hover:bg-red-500 hover:text-white' : 'text-slate-500 hover:bg-red-100 hover:text-red-700'}"
        aria-label="Delete board {boardName}"
        title="Delete"
      >
        <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
        </svg>
      </button>
    </div>
  {/if}
</li>
