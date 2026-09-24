import { createMcpHonoApp } from "@modelcontextprotocol/hono";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { packageName, packageVersion } from "./meta.ts";
import { toolInputSchema } from "./tools/convert_svg_to_swiftui.schema.ts";
import { convertSvgTool } from "./tools/convert_svg_to_swiftui.ts";
import { env, MAX_REQUEST_BODY_BYTES } from "./validation.ts";

export function createMcpApp() {
  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: packageName, version: packageVersion });
    server.registerTool(
      "convert_svg_to_swiftui",
      {
        description:
          "Convert complete inline SVG source into a SwiftUI Shape using svg-to-swiftui-core 0.4.0.",
        inputSchema: toStandardJsonSchema(toolInputSchema),
      },
      convertSvgTool,
    );
    return server;
  }, { maxRequestBodySize: MAX_REQUEST_BODY_BYTES });

  const app = createMcpHonoApp({
    host: env.hostname,
    maxRequestBodySize: MAX_REQUEST_BODY_BYTES,
  });
  app.all("/mcp", (c) => {
    // Hono has already checked the body limit and parsed it before the SDK handles the request.
    const parsedBody = (c as unknown as { get(key: "parsedBody"): unknown }).get("parsedBody");
    return handler.fetch(c.req.raw, { parsedBody });
  });
  return app;
}

export const mcpApp = createMcpApp();
