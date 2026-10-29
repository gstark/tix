import type { ScrollBoxRenderable } from "@opentui/core";
import type { RefObject } from "react";
import type { Row, TaskRow } from "./board.ts";
import { statusOf, truncate } from "./board.ts";
import { Flap } from "./Flap.tsx";
import { color, statusColor } from "./theme.ts";

/** The columns in front of the tree: cursor, flap cell, short ID. */
const CURSOR = 1;
const FLAP = 7;
const ID = 12;
const CHEVRON = 2;

export const rowId = (shortId: string) => `row-${shortId}`;

type Props = {
  rows: Row[];
  selectedId: string | null;
  focused: boolean;
  width: number;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
  onSelect: (shortId: string) => void;
  onToggle: (shortId: string) => void;
  empty: string;
};

export function Board({ rows, selectedId, focused, width, scrollRef, onSelect, onToggle, empty }: Props) {
  if (rows.length === 0) {
    return (
      <box width={width} paddingLeft={2} paddingTop={1}>
        <text fg={color.soot}>{empty}</text>
      </box>
    );
  }
  return (
    <scrollbox ref={scrollRef} width={width} scrollbarOptions={{ visible: false }}>
      {rows.map((row, index) =>
        row.kind === "project" ? (
          <box key={`project-${row.key}`} height={1} marginTop={index === 0 ? 0 : 1} paddingLeft={CURSOR + 1}>
            <text>
              <span fg={color.chalk}>
                <strong>{row.key}</strong>
              </span>
              <span fg={color.soot}>{`  ${row.count}`}</span>
            </text>
          </box>
        ) : (
          <BoardRow
            key={row.task.shortId}
            row={row}
            width={width}
            selected={row.task.shortId === selectedId}
            focused={focused}
            onSelect={onSelect}
            onToggle={onToggle}
          />
        ),
      )}
    </scrollbox>
  );
}

type RowProps = {
  row: TaskRow;
  width: number;
  selected: boolean;
  focused: boolean;
  onSelect: (shortId: string) => void;
  onToggle: (shortId: string) => void;
};

function BoardRow({ row, width, selected, focused, onSelect, onToggle }: RowProps) {
  const { task, guides, childCount, collapsed } = row;
  const status = statusOf(task);
  const chevron = childCount === 0 ? "  " : collapsed ? "▸ " : "▾ ";
  const chevronStart = CURSOR + FLAP + ID + Bun.stringWidth(guides);
  const more = collapsed ? `  +${childCount}` : "";
  const room = width - chevronStart - CHEVRON - Bun.stringWidth(more) - 1;
  return (
    <box
      id={rowId(task.shortId)}
      height={1}
      flexDirection="row"
      backgroundColor={selected ? color.rail : undefined}
      onMouseDown={(event) => {
        // A click on the chevron opens or closes the subtree. The board starts at column 0.
        const onChevron = childCount > 0 && event.x >= chevronStart && event.x < chevronStart + CHEVRON;
        if (onChevron) onToggle(task.shortId);
        else onSelect(task.shortId);
      }}
    >
      <text fg={focused ? color.flap : color.soot} flexShrink={0}>
        {selected ? "▌" : " "}
      </text>
      <Flap word={status} fg={statusColor[status]} bg={selected ? color.rule : color.rail} />
      <text flexShrink={0} wrapMode="none">
        <span fg={selected ? color.chalk : color.soot}>{`  ${task.shortId}  `}</span>
        <span fg={color.rule}>{guides}</span>
        <span fg={color.flap}>{chevron}</span>
        <span fg={task.completed ? color.soot : color.chalk}>
          {selected ? <strong>{truncate(task.name, room)}</strong> : truncate(task.name, room)}
        </span>
        <span fg={color.soot}>{more}</span>
      </text>
    </box>
  );
}
