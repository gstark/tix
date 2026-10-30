/** The board and the ticket share one row at this width and above. Below it, they take turns. */
export const NARROW = 100;

/** The list keeps the status, the short ID, and a short name. */
export const MIN_BOARD = 32;

/** The ticket keeps a readable column of text. */
export const MIN_TICKET = 40;

/** Half of the terminal, kept between 48 and 96 columns. This is the width before a drag. */
export function defaultBoardWidth(terminalWidth: number): number {
  return Math.min(96, Math.max(48, Math.floor(terminalWidth * 0.5)));
}

/** Keeps both panes readable. `requested` is a terminal column count for the list. */
export function clampBoardWidth(terminalWidth: number, requested: number): number {
  const max = Math.max(1, terminalWidth - MIN_TICKET);
  const min = Math.min(MIN_BOARD, max);
  return Math.max(min, Math.min(max, Math.round(requested)));
}

/**
 * The list width for this terminal.
 * A saved width stays put when the terminal changes size, and it clamps when it no longer fits.
 * With no saved width, the list uses defaultBoardWidth.
 */
export function resolveBoardWidth(terminalWidth: number, saved: number | null): number {
  if (terminalWidth < NARROW) return terminalWidth;
  return clampBoardWidth(terminalWidth, saved ?? defaultBoardWidth(terminalWidth));
}
