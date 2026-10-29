import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "../mcp/server.ts";
import { noPositionals } from "./command.ts";
import type { Command } from "./command.ts";

export const mcp: Command = {
  name: "mcp",
  usage: "mcp",
  summary: "Start the MCP server on stdio.",
  notes: ["", "The server finds the project from its working directory. The create_task and list_tasks tools also accept a project argument."],
  async run(ctx, input) {
    noPositionals(input);
    // The open stdin keeps the process running after run returns.
    await createMcpServer(ctx).connect(new StdioServerTransport());
  },
};
