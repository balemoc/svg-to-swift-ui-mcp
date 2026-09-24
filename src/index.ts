import { Hono } from "hono";
import { createMcpRoute } from "./mcp.ts";

const portValue = Deno.env.get("PORT") ?? "8000";
const port = Number(portValue);
if (!/^[0-9]+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const app = new Hono();
app.route("/mcp", await createMcpRoute());
Deno.serve({ hostname: "127.0.0.1", port }, app.fetch);
