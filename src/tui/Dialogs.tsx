/** @jsxImportSource @opentui/react */
import type { TextareaRenderable } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { truncate } from "./board.ts";
import { color } from "./theme.ts";

function Frame({ title, width, children, hint }: { title: string; width: number; children: ReactNode; hint: string }) {
  const terminal = useTerminalDimensions();
  const frameWidth = Math.min(width, terminal.width - 4);
  return (
    <box
      position="absolute"
      top={2}
      left={Math.floor((terminal.width - frameWidth) / 2)}
      width={frameWidth}
      zIndex={10}
      flexDirection="column"
      backgroundColor={color.rail}
      border
      borderStyle="rounded"
      borderColor={color.flap}
      title={` ${title} `}
      titleColor={color.flap}
      paddingLeft={1}
      paddingRight={1}
    >
      {children}
      <box marginTop={1} height={1}>
        <text fg={color.soot}>{hint}</text>
      </box>
    </box>
  );
}

export type Field = {
  key: string;
  label: string;
  /** "line" is one line. Enter in a line saves the form. "text" has many lines. */
  kind: "line" | "text";
  initial: string;
  placeholder?: string;
};

type FormProps = {
  title: string;
  fields: Field[];
  save: string;
  onSave: (values: Record<string, string>) => void;
  onCancel: () => void;
};

export function Form({ title, fields, save, onSave, onCancel }: FormProps) {
  const [focus, setFocus] = useState(0);
  const [lines, setLines] = useState(() => Object.fromEntries(fields.map((field) => [field.key, field.initial])));
  const areas = useRef(new Map<string, TextareaRenderable>());

  const submit = () => {
    const values = { ...lines };
    for (const [key, area] of areas.current) values[key] = area.plainText;
    onSave(values);
  };

  useKeyboard((key) => {
    if (key.name === "escape") onCancel();
    else if (key.ctrl && key.name === "s") submit();
    else if (key.name === "tab") {
      const step = key.shift ? fields.length - 1 : 1;
      setFocus((index) => (index + step) % fields.length);
    }
  });

  return (
    <Frame title={title} width={76} hint={`tab next field   ctrl+s ${save.toLowerCase()}   esc cancel`}>
      {fields.map((field, index) => (
        <box key={field.key} flexDirection="column" marginTop={1}>
          <text fg={index === focus ? color.flap : color.soot}>{field.label}</text>
          {field.kind === "line" ? (
            <input
              value={field.initial}
              placeholder={field.placeholder}
              focused={index === focus}
              backgroundColor={color.platform}
              focusedBackgroundColor={color.platform}
              textColor={color.chalk}
              placeholderColor={color.soot}
              onInput={(value) => setLines((current) => ({ ...current, [field.key]: value }))}
              onSubmit={submit}
            />
          ) : (
            <textarea
              ref={(area: TextareaRenderable | null) => {
                if (area) areas.current.set(field.key, area);
                else areas.current.delete(field.key);
              }}
              initialValue={field.initial}
              placeholder={field.placeholder}
              focused={index === focus}
              height={10}
              backgroundColor={color.platform}
              focusedBackgroundColor={color.platform}
              textColor={color.chalk}
              placeholderColor={color.soot}
              wrapMode="word"
            />
          )}
        </box>
      ))}
      <box marginTop={1} height={1} onMouseDown={submit}>
        <text bg={color.flap} fg={color.platform}>{` ${save} `}</text>
      </box>
    </Frame>
  );
}

export type Choice = { value: string; label: string; detail?: string; fg?: string };

type PickerProps = {
  title: string;
  choices: Choice[];
  empty: string;
  onPick: (value: string) => void;
  onCancel: () => void;
};

const PICKER_ROWS = 12;

export function Picker({ title, choices, empty, onPick, onCancel }: PickerProps) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const needle = query.trim().toLowerCase();
  const shown = choices.filter(
    (choice) => choice.label.toLowerCase().includes(needle) || choice.value.toLowerCase().startsWith(needle),
  );
  const index = Math.min(cursor, Math.max(0, shown.length - 1));
  // The window ends at the cursor when the cursor is below the first page.
  const first = Math.max(0, index - PICKER_ROWS + 1);

  useKeyboard((key) => {
    if (key.name === "escape") onCancel();
    else if (key.name === "down" || (key.ctrl && key.name === "n")) setCursor(Math.min(index + 1, shown.length - 1));
    else if (key.name === "up" || (key.ctrl && key.name === "p")) setCursor(Math.max(index - 1, 0));
    else if (key.name === "return" && shown[index]) onPick(shown[index].value);
  });

  return (
    <Frame title={title} width={76} hint="type to filter   ↑↓ move   enter choose   esc cancel">
      <box marginTop={1}>
        <input
          focused
          placeholder="Filter"
          backgroundColor={color.platform}
          focusedBackgroundColor={color.platform}
          textColor={color.chalk}
          placeholderColor={color.soot}
          onInput={(value) => {
            setQuery(value);
            setCursor(0);
          }}
        />
      </box>
      <box marginTop={1} flexDirection="column" height={Math.min(PICKER_ROWS, Math.max(1, shown.length))}>
        {shown.length === 0 ? (
          <text fg={color.soot}>{empty}</text>
        ) : (
          shown.slice(first, first + PICKER_ROWS).map((choice, offset) => {
            const active = first + offset === index;
            return (
              <box
                key={choice.value}
                height={1}
                backgroundColor={active ? color.platform : undefined}
                onMouseDown={() => onPick(choice.value)}
                onMouseOver={() => setCursor(first + offset)}
              >
                <text wrapMode="none">
                  <span fg={active ? color.flap : color.rail}>{"▌"}</span>
                  <span fg={choice.fg ?? color.chalk}>{truncate(choice.label, 50)}</span>
                  {choice.detail && <span fg={color.soot}>{`  ${choice.detail}`}</span>}
                </text>
              </box>
            );
          })
        )}
      </box>
    </Frame>
  );
}

type ConfirmProps = { title: string; message: string; yes: string; onYes: () => void; onCancel: () => void };

export function Confirm({ title, message, yes, onYes, onCancel }: ConfirmProps) {
  useKeyboard((key) => {
    if (key.name === "y") onYes();
    else if (key.name === "n" || key.name === "escape") onCancel();
  });
  return (
    <Frame title={title} width={60} hint={`y ${yes.toLowerCase()}   n keep it`}>
      <box marginTop={1}>
        <text fg={color.chalk}>{message}</text>
      </box>
      <box marginTop={1} height={1} flexDirection="row" gap={2}>
        <box onMouseDown={onYes}>
          <text bg={color.signal} fg={color.platform}>{` ${yes} `}</text>
        </box>
        <box onMouseDown={onCancel}>
          <text bg={color.platform} fg={color.chalk}>{" Keep it "}</text>
        </box>
      </box>
    </Frame>
  );
}

export const KEYS: [string, [string, string][]][] = [
  [
    "Move",
    [
      ["j k  ↑ ↓", "Select the next or previous task"],
      ["g G", "Go to the first or last task"],
      ["h l  ← →", "Close or open a subtree"],
      ["enter", "Open or close the subtree"],
      ["tab", "Scroll the ticket with j and k, or go back to the board"],
      ["/", "Find tasks by name or ID"],
    ],
  ],
  [
    "Show",
    [
      ["1 2 3 4", "Show open, ready, all, or closed tasks"],
      ["f", "Show the next list"],
      ["p", "Choose the project"],
    ],
  ],
  [
    "Change",
    [
      ["s", "Start the task"],
      ["d", "Close the task with a result"],
      ["o", "Reopen the task"],
      ["n", "Create a task"],
      ["a", "Create a subtask"],
      ["e", "Edit the task"],
      ["E", "Edit the description in $EDITOR"],
      ["b u", "Add or remove a blocker"],
      ["x", "Delete the task and its subtasks"],
      ["y", "Copy the short ID"],
      ["drag", "Copy the text that you select with the mouse"],
      ["drag line", "Resize the list and the ticket"],
    ],
  ],
];

export function Help({ onClose }: { onClose: () => void }) {
  useKeyboard(() => onClose());
  return (
    <Frame title="Keys" width={72} hint="Press any key to close. You can also click and scroll.">
      {KEYS.map(([group, keys]) => (
        <box key={group} flexDirection="column" marginTop={1}>
          <text fg={color.soot}>
            <strong>{group}</strong>
          </text>
          {keys.map(([key, text]) => (
            <text key={key}>
              <span fg={color.flap}>{key.padEnd(12)}</span>
              <span fg={color.chalk}>{text}</span>
            </text>
          ))}
        </box>
      ))}
    </Frame>
  );
}
