/** @jsxImportSource @opentui/react */
import { useState, useSyncExternalStore } from "react";
import { color } from "./theme.ts";
import { flapFrame, flapLength, pad } from "./flap.ts";

const TICK_MS = 26;

// One shared clock drives every turning cell. It runs only while a cell turns.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let now = Date.now();

function subscribeTick(listener: () => void): () => void {
  listeners.add(listener);
  timer ??= setInterval(() => {
    now = Date.now();
    for (const each of listeners) each();
  }, TICK_MS);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const getNow = () => now;
const noSubscribe = () => () => {};

/** Set TIX_MOTION=off to show each new word at once. */
const motion = process.env.TIX_MOTION !== "off";

type Turn = { from: string; to: string; at: number };

const ticksAt = (turn: Turn, time: number) => Math.max(0, Math.floor((time - turn.at) / TICK_MS));

/**
 * A split-flap status cell. A new word turns in letter by letter. A new cell
 * turns in from blank, so the board fills in like a departures board.
 */
export function Flap({ word, fg, bg = color.rail }: { word: string; fg: string; bg?: string }) {
  const [turn, setTurn] = useState<Turn>(() => ({ from: motion ? "" : word, to: word, at: Date.now() }));
  if (turn.to !== word) {
    // Start from the letters on the cell now, so a turn can change direction.
    setTurn({ from: motion ? flapFrame(turn.from, turn.to, ticksAt(turn, Date.now())) : word, to: word, at: Date.now() });
  }
  const turning = ticksAt(turn, Date.now()) < flapLength(turn.from, turn.to);
  const time = useSyncExternalStore(turning ? subscribeTick : noSubscribe, getNow);
  const shown = turning ? flapFrame(turn.from, turn.to, ticksAt(turn, time)) : pad(turn.to);
  return (
    <text bg={bg} fg={fg} flexShrink={0}>
      {` ${shown} `}
    </text>
  );
}
