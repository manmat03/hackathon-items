import { Component, createEffect, For, Show } from "solid-js";
import type { InterviewMessage } from "../lib/types";
import "./TranscriptPane.css";

export const TranscriptPane: Component<{
  messages: InterviewMessage[];
  liveLumo?: string;
}> = (props) => {
  let scrollRef: HTMLDivElement | undefined;

  // Keep the pane scrolled to the latest line as the conversation grows.
  createEffect(() => {
    void props.messages.length;
    void props.liveLumo;
    queueMicrotask(() => {
      if (scrollRef) scrollRef.scrollTop = scrollRef.scrollHeight;
    });
  });

  return (
    <aside class="transcript-pane" aria-label="Conversation transcript">
      <div class="transcript-head">Conversation</div>
      <div class="transcript-scroll" ref={scrollRef}>
        <For each={props.messages}>
          {(m) => (
            <div class={`turn turn-${m.role}`}>
              <div class="turn-who">{m.role === "lumo" ? "Lumo" : "You"}</div>
              <p class="turn-text">{m.content}</p>
            </div>
          )}
        </For>
        <Show when={props.liveLumo && props.liveLumo.trim().length > 0}>
          <div class="turn turn-lumo turn-live">
            <div class="turn-who">Lumo</div>
            <p class="turn-text">
              {props.liveLumo}
              <span class="live-caret" aria-hidden="true" />
            </p>
          </div>
        </Show>
      </div>
    </aside>
  );
};
