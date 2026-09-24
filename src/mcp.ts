import { createMcpHonoApp } from "@modelcontextprotocol/hono";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as v from "valibot";
import { convertSvg } from "./convert.ts";
import { MAX_REQUEST_BODY_BYTES, toolInputSchema } from "./validation.ts";

export function createMcpRoute() {
  const handler = createMcpHandler(() => {
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
                text: error instanceof v.ValiError
                  ? error.message
                  : "SVG conversion failed. Check that the input is valid inline SVG markup.",
              },
            ],
          };
        }
      },
    );
    return server;
  }, { maxRequestBodySize: MAX_REQUEST_BODY_BYTES });

  const app = createMcpHonoApp({ maxRequestBodySize: MAX_REQUEST_BODY_BYTES });
  app.all("/", (c) => {
    // Hono has already checked the body limit and parsed it before the SDK handles the request.
    const parsedBody = (c as unknown as { get(key: "parsedBody"): unknown }).get("parsedBody");
    return handler.fetch(c.req.raw, { parsedBody });
  });
  return app;
}
