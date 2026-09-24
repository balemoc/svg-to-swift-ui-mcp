import { createMcpHonoApp } from "@modelcontextprotocol/hono";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { McpServer, WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import * as v from "valibot";

import { convertSvg, MAX_SVG_BYTES } from "./convert.ts";

export async function createMcpRoute() {
  const server = new McpServer({ name: "svg-to-swift-ui", version: "0.1.0" });
  server.registerTool(
    "convert_svg_to_swiftui",
    {
      description:
        "Convert complete inline SVG source into a SwiftUI Shape using svg-to-swiftui-core 0.4.0.",
      inputSchema: toStandardJsonSchema(v.object({
        svg: v.pipe(
          v.string(),
          v.minLength(1),
          v.maxLength(MAX_SVG_BYTES),
          v.description("Complete SVG markup, including the <svg> root"),
        ),
        structName: v.optional(
          v.pipe(
            v.string(),
            v.regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
            v.maxLength(64),
            v.description("Swift type name to generate"),
          ),
          "MyCustomShape",
        ),
        precision: v.optional(v.pipe(
          v.number(),
          v.integer(),
          v.minValue(0),
          v.maxValue(100),
          v.description("Decimal places for path coordinates (0–100); omit for library default"),
        )),
        indentationSize: v.optional(v.pipe(
          v.number(),
          v.integer(),
          v.minValue(0),
          v.maxValue(32),
          v.description("Spaces per indentation level (0–32); omit for library default"),
        )),
        usageCommentPrefix: v.optional(v.pipe(
          v.boolean(),
          v.description("Include a SwiftUI usage comment before the generated Shape"),
        )),
      })),
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

  const app = createMcpHonoApp({ maxRequestBodySize: 300 * 1024 });
  app.all("/", (c) => {
    // The SDK middleware sets this variable, but its app factory doesn't expose it in Hono's type.
    const parsedBody = (c as unknown as { get(key: "parsedBody"): unknown }).get("parsedBody");
    return transport.handleRequest(c.req.raw, { parsedBody });
  });
  return app;
}
