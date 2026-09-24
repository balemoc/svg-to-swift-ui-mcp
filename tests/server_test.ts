import { Hono } from "hono";
import { convertSvg, MAX_SVG_BYTES } from "../src/convert.ts";
import { createMcpRoute } from "../src/mcp.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';

Deno.test("converter produces named SwiftUI source and rejects oversized input", () => {
  assert(
    convertSvg(svg, { structName: "CircleIcon" }).includes("struct CircleIcon: Shape"),
    "missing generated Shape",
  );
  try {
    convertSvg("é".repeat(MAX_SVG_BYTES / 2 + 1), { structName: "CircleIcon" });
    throw new Error("oversized SVG was accepted");
  } catch (error) {
    assert(String(error).includes("SVG must not exceed"), "unexpected size error");
  }
});

Deno.test("MCP initializes, lists the tool, converts SVG, and reports failures", async () => {
  const app = new Hono();
  app.route("/mcp", await createMcpRoute());
  let id = 0;
  async function call(method: string, params: unknown = {}) {
    const response = await app.request("http://127.0.0.1:8000/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        host: "127.0.0.1:8000",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    if (!response.ok) {
      throw new Error(`${method} HTTP ${response.status}: ${await response.text()}`);
    }
    const body = await response.text();
    if (response.headers.get("content-type")?.startsWith("text/event-stream")) {
      const data = body.split("\n").find((line) => line.startsWith("data: "));
      assert(data, `missing SSE result for ${method}`);
      return JSON.parse(data.slice(6));
    }
    return JSON.parse(body);
  }

  const init = await call("initialize", {
    protocolVersion: "2026-07-28",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" },
  });
  assert(init.result?.serverInfo?.name === "svg-to-swift-ui", "MCP initialization failed");

  const listed = await call("tools/list");
  assert(listed.result?.tools?.[0]?.name === "convert_svg_to_swiftui", "tool not listed");
  const inputSchema = listed.result.tools[0].inputSchema;
  assert(inputSchema.properties?.svg?.description?.includes("Complete SVG"), "SVG schema missing");
  assert(inputSchema.required?.includes("svg"), "SVG must be required");
  assert(!inputSchema.required?.includes("structName"), "structName must be optional");
  for (const option of ["precision", "indentationSize", "usageCommentPrefix"]) {
    assert(inputSchema.properties?.[option], `${option} schema missing`);
    assert(!inputSchema.required?.includes(option), `${option} must be optional`);
  }

  const converted = await call("tools/call", {
    name: "convert_svg_to_swiftui",
    arguments: { svg, structName: "CircleIcon" },
  });
  assert(
    converted.result?.content?.[0]?.text?.includes("struct CircleIcon: Shape"),
    "conversion failed",
  );

  const defaultName = await call("tools/call", {
    name: "convert_svg_to_swiftui",
    arguments: { svg },
  });
  assert(
    defaultName.result?.content?.[0]?.text?.includes("struct MyCustomShape: Shape"),
    "default name should be applied",
  );

  const detailed = await call("tools/call", {
    name: "convert_svg_to_swiftui",
    arguments: {
      svg:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 3"><path d="M 1 1 L 2 2"/></svg>',
      structName: "DetailedShape",
      precision: 2,
      indentationSize: 2,
      usageCommentPrefix: true,
    },
  });
  const source = detailed.result?.content?.[0]?.text;
  assert(source?.startsWith("// To use this shape"), "usage comment missing");
  assert(source?.includes("  func path(in rect: CGRect)"), "indentationSize not applied");
  assert(source?.includes("0.33*width"), "precision not applied");

  for (
    const arguments_ of [
      { svg, precision: 101 },
      { svg, precision: 1.5 },
      { svg, indentationSize: -1 },
      { svg, indentationSize: 33 },
      { svg, usageCommentPrefix: "yes" },
    ]
  ) {
    const invalid = await call("tools/call", {
      name: "convert_svg_to_swiftui",
      arguments: arguments_,
    });
    assert(invalid.result?.isError === true, "invalid converter option should fail");
  }

  const invalidName = await call("tools/call", {
    name: "convert_svg_to_swiftui",
    arguments: { svg, structName: "Bad-Name" },
  });
  assert(invalidName.result?.isError === true, "invalid name should fail");

  const malformed = await call("tools/call", {
    name: "convert_svg_to_swiftui",
    arguments: { svg: "not an svg" },
  });
  assert(malformed.result?.isError === true, "malformed SVG should fail");

  const tooLarge = await app.request("http://127.0.0.1:8000/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", host: "127.0.0.1:8000" },
    body: JSON.stringify({ svg: "x".repeat(300 * 1024) }),
  });
  assert(tooLarge.status === 413, "oversized HTTP body should be rejected");

  const rebinding = await app.request("http://untrusted.example/mcp", {
    method: "GET",
    headers: { host: "untrusted.example" },
  });
  assert(rebinding.status === 403, "untrusted Host should be rejected");
});
