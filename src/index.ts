import { Hono } from "hono";
import * as v from "valibot";
import { createMcpRoute } from "./mcp.ts";

const portSchema = v.pipe(
  v.string(),
  v.regex(/^[0-9]+$/),
  v.transform(Number),
  v.integer(),
  v.minValue(1),
  v.maxValue(65535),
);
const portResult = v.safeParse(portSchema, Deno.env.get("PORT") ?? "8000");
if (!portResult.success) throw new Error("PORT must be an integer between 1 and 65535");
const port = portResult.output;

const app = new Hono();
app.route("/mcp", await createMcpRoute());
Deno.serve({ hostname: "127.0.0.1", port }, app.fetch);
