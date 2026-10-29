import { basename } from "node:path";
import { TixError } from "./errors.ts";

export type ParsedPlan = { name: string; description: string };

/** Reads the task name and description from a plan document. */
export function parsePlan(content: string, fileName: string): ParsedPlan {
  if (content.trim() === "") throw new TixError("USAGE", `Plan file ${fileName} is empty`);
  const heading = /^# (.+)$/m.exec(content);
  const title = heading ? heading[1].trim() : basename(fileName, ".md");
  return { name: title.replace(/^plan:\s*/i, ""), description: content };
}
