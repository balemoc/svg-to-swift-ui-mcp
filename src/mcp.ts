import { createMcpHonoApp } from "@modelcontextprotocol/hono";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { McpServer, WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { convertSvg } from "./convert.ts";
import { MAX_REQUEST_BODY_BYTES, toolInputSchema } from "./validation.ts";

export async function createMcpRoute() {
  const server = new McpServer({ name: "svg-to-swift-ui", version: "0.1.0" });
  server.registerTool(
    "convert_svg_to_swiftui",
    {
      description:
        "Convert complete inline SVG source into a SwiftUI Shape using svg-to-swiftui-core 0.4.0.",
      inputSchema: toStandardJsonSchema(toolInputSchema),
    },
    ({ svg, structName, precision, indentationSize, usageCommentPrefix }) => {
      try {
        return {
          content: [{
            type: "text" as const,
            text: convertSvg(svg, { structName, precision, indentationSize, usageCommentPrefix }),
          }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: error instanceof Error ? error.message : "Conversion failed",
            },
          ],
        };
      }
    },
  );

  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  const app = createMcpHonoApp({ maxRequestBodySize: MAX_REQUEST_BODY_BYTES });
  app.all("/", (c) => {
    // The SDK middleware sets this variable, but its app factory doesn't expose it in Hono's type.
    const parsedBody = (c as unknown as { get(key: "parsedBody"): unknown }).get("parsedBody");
    return transport.handleRequest(c.req.raw, { parsedBody });
  });
  return app;
}
