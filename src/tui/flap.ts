/**
 * A split-flap cell. Each position turns forward through the alphabet, one
 * letter for each tick, until it shows the letter of the new word. A real
 * board cannot turn backward, so a position can pass through "z" and the blank.
 */
export const FLAP_ALPHABET = " abcdefghijklmnopqrstuvwxyz";
export const FLAP_WIDTH = 5;

export function pad(word: string): string {
  return word.padEnd(FLAP_WIDTH).slice(0, FLAP_WIDTH);
}

function turns(from: string, to: string): number {
  const start = FLAP_ALPHABET.indexOf(from);
  const end = FLAP_ALPHABET.indexOf(to);
  if (start < 0 || end < 0) return 0;
  return (end - start + FLAP_ALPHABET.length) % FLAP_ALPHABET.length;
}

/** The cell after `ticks` turns from the word `from` to the word `to`. */
export function flapFrame(from: string, to: string, ticks: number): string {
  const source = pad(from);
  const target = pad(to);
  let frame = "";
  for (let i = 0; i < FLAP_WIDTH; i++) {
    const needed = turns(source[i], target[i]);
    if (ticks >= needed) {
      frame += target[i];
    } else {
      frame += FLAP_ALPHABET[(FLAP_ALPHABET.indexOf(source[i]) + ticks) % FLAP_ALPHABET.length];
    }
  }
  return frame;
}

/** The number of ticks until the cell shows `to`. */
export function flapLength(from: string, to: string): number {
  const source = pad(from);
  const target = pad(to);
  let max = 0;
  for (let i = 0; i < FLAP_WIDTH; i++) max = Math.max(max, turns(source[i], target[i]));
  return max;
}
