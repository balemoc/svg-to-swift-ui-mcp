import { mcpApp } from "./mcp.ts";
import { env } from "./validation.ts";

Deno.serve(env, mcpApp.fetch);
