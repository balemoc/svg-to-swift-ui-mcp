import type { CallToolResult } from "@modelcontextprotocol/server";
import { convert } from "svg-to-swiftui-core";
import * as v from "valibot";
import { svgBytesSchema, type toolInputSchema } from "../validation.ts";

export function convertSvgTool(
  { svg, structName, precision, indentationSize, usageCommentPrefix }: v.InferOutput<
    typeof toolInputSchema
  >,
): CallToolResult {
  try {
    v.parse(svgBytesSchema, svg);
    return {
      isError: false,
      content: [{
        type: "text",
        text: convert(svg, { structName, precision, indentationSize, usageCommentPrefix }),
      }],
    };
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: "text",
        text: error instanceof v.ValiError
          ? error.message
          : "SVG conversion failed. Check that the input is valid inline SVG markup.",
      }],
    };
  }
}
