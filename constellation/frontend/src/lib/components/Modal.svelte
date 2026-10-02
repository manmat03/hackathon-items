<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    onclose: () => void;
    children: Snippet;
    footer?: Snippet;
  }

  let { title, onclose, children, footer }: Props = $props();

  let dialog = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    dialog?.showModal();
  });

  function onBackdropClick(event: MouseEvent) {
    if (event.target === dialog) onclose();
  }
</script>

<dialog
  bind:this={dialog}
  onclose={onclose}
  onclick={onBackdropClick}
  class="m-auto w-full max-w-lg rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-[1px]"
>
  <div class="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
    <h2 class="text-lg font-semibold leading-tight">{title}</h2>
    <button
      type="button"
      onclick={onclose}
      aria-label="Close"
      class="-m-1 rounded p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
    >
      <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  </div>
  <div class="px-5 py-4">
    {@render children()}
  </div>
  {#if footer}
    <div class="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
      {@render footer()}
    </div>
  {/if}
</dialog>
