<script lang="ts">
  import { tick } from "svelte";
  import { queryBoard } from "../api";
  import { board } from "../stores/board.svelte";

  interface Exchange {
    id: number;
    question: string;
    answer: string | null;
    error: string | null;
  }

  let question = $state("");
  let history = $state<Exchange[]>([]);
  let pending = $state(false);
  let log = $state<HTMLDivElement | null>(null);
  let nextId = 0;

  let disabled = $derived(pending || !board.selectedBoardId || board.offline);

  const suggestions = [
    "Which tasks are overdue?",
    "What's blocking the final task?",
    "How long until everything is done?",
  ];

  async function ask(text = question) {
    const q = text.trim();
    if (!q || !board.selectedBoardId || pending) return;
    question = "";
    // Mutate the proxied entry inside `history`, not the plain object passed to
    // push(): Svelte 5 only tracks changes made through the state proxy.
    history.push({ id: nextId++, question: q, answer: null, error: null });
    const entry = history[history.length - 1];
    pending = true;
    await scrollToEnd();
    try {
      entry.answer = await queryBoard(board.selectedBoardId, q);
    } catch (e) {
      entry.error = (e as Error).message;
    } finally {
      pending = false;
      await scrollToEnd();
    }
  }

  async function scrollToEnd() {
    await tick();
    log?.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      ask();
    }
  }
</script>

<aside class="flex h-full min-h-0 flex-col border-l border-slate-200 bg-slate-50">
  <div class="border-b border-slate-200 px-4 py-3">
    <h2 class="text-sm font-semibold text-slate-900">PM assistant</h2>
    <p class="text-xs text-slate-500">Ask timeline questions about this board.</p>
  </div>

  <div bind:this={log} class="flex-1 space-y-3 overflow-y-auto px-4 py-3">
    {#if history.length === 0}
      <div class="space-y-2">
        <p class="text-xs text-slate-500">Try asking:</p>
        {#each suggestions as s}
          <button
            type="button"
            {disabled}
            onclick={() => ask(s)}
            class="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50"
          >
            {s}
          </button>
        {/each}
      </div>
    {/if}

    {#each history as entry (entry.id)}
      <div class="space-y-1.5">
        <div class="ml-6 rounded-lg rounded-br-sm bg-indigo-600 px-3 py-2 text-sm text-white">
          {entry.question}
        </div>
        <div class="mr-6 rounded-lg rounded-bl-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
          {#if entry.error}
            <span class="text-red-600">{entry.error}</span>
          {:else if entry.answer === null}
            <span class="inline-flex items-center gap-1 text-slate-400">
              <span class="size-1.5 animate-bounce rounded-full bg-slate-400"></span>
              <span class="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]"></span>
              <span class="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]"></span>
            </span>
          {:else}
            <p class="whitespace-pre-wrap leading-relaxed">{entry.answer}</p>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <form
    class="border-t border-slate-200 p-3"
    onsubmit={(e) => {
      e.preventDefault();
      ask();
    }}
  >
    <textarea
      bind:value={question}
      onkeydown={onKeyDown}
      rows="2"
      {disabled}
      placeholder={board.offline ? "Assistant needs the backend running" : "Ask a question…"}
      class="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
    ></textarea>
    <div class="mt-2 flex justify-end">
      <button
        type="submit"
        disabled={disabled || !question.trim()}
        class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? "Thinking…" : "Ask"}
      </button>
    </div>
  </form>
</aside>
