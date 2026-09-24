import { Hono } from "hono";
import { mcpRoute } from "./mcp.ts";
import { env } from "./validation.ts";

const app = new Hono();

app.route("/mcp", mcpRoute);

Deno.serve(env, app.fetch);
