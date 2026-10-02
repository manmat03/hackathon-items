import { Component } from "solid-js";
import "./Lumo.css";

export type LumoState = "idle" | "listening" | "speaking" | "thinking";

export const Lumo: Component<{ state?: LumoState; size?: number; label?: string }> = (
  props
) => {
  const size = () => props.size ?? 110;
  const state = () => props.state ?? "idle";
  const label = () => props.label ?? "Lumo";

  return (
    <div class="lumo" data-state={state()} aria-hidden="true">
      <div class="orb-stack" style={{ width: `${size()}px` }}>
        <div class="halo" />
        <div class="ring outer" />
        <div class="ring" />
        <div class="orb" />
      </div>
      <span class="lumo-label">{label()}</span>
    </div>
  );
};
