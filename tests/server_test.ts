import { Hono } from "hono";
import * as v from "valibot";
import { convertSvg } from "../src/convert.ts";
import { createMcpRoute } from "../src/mcp.ts";
import {
  MAX_REQUEST_BODY_BYTES,
  MAX_SVG_BYTES,
  portSchema,
  svgBytesSchema,
} from "../src/validation.ts";

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

Deno.test("validation enforces SVG byte boundary and port range", () => {
  const svgAtLimit = "é".repeat(MAX_SVG_BYTES / 2);
  assert(v.safeParse(svgBytesSchema, svgAtLimit).success, "SVG at byte limit rejected");
  assert(!v.safeParse(svgBytesSchema, svgAtLimit + "é").success, "oversized SVG accepted");

  for (const port of ["1", "65535"]) {
    assert(v.safeParse(portSchema, port).success, `valid port ${port} rejected`);
  }
  for (const port of ["0", "65536", "1.5", "abc"]) {
    assert(!v.safeParse(portSchema, port).success, `invalid port ${port} accepted`);
  }
});

async function createTestApp() {
  const app = new Hono();
  app.route("/mcp", await createMcpRoute());
  return app;
}

function createCaller(app: Hono) {
  let id = 0;
  return async (method: string, params: unknown = {}) => {
    const requestId = ++id;
    const response = await app.request("http://127.0.0.1:8000/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        host: "127.0.0.1:8000",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }),
    });
    if (!response.ok) {
      throw new Error(`${method} HTTP ${response.status}: ${await response.text()}`);
    }
    const body = await response.text();
    if (response.headers.get("content-type")?.startsWith("text/event-stream")) {
      const messages = body.split(/\r?\n\r?\n/).flatMap((event) => {
        const data = event.split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        return data ? [JSON.parse(data)] : [];
      });
      const message = messages.find((message) => message.id === requestId);
      assert(message, `missing SSE result for ${method} (id ${requestId})`);
      return message;
    }
    const message = JSON.parse(body);
    assert(message.id === requestId, `unexpected JSON-RPC id for ${method}`);
    return message;
  };
}

Deno.test("converter applies formatting options", () => {
  const source = convertSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 3"><path d="M 1 1 L 2 2"/></svg>',
    { structName: "DetailedShape", precision: 2, indentationSize: 2, usageCommentPrefix: true },
  );
  assert(source.startsWith("// To use this shape"), "usage comment missing");
  assert(source.includes("  func path(in rect: CGRect)"), "indentationSize not applied");
  assert(source.includes("0.33*width"), "precision not applied");
});

Deno.test("MCP initializes and advertises the converter tool", async () => {
  const call = createCaller(await createTestApp());
  const init = await call("initialize", {
    protocolVersion: "2026-07-28",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" },
  });
  assert(init.result?.serverInfo?.name === "svg-to-swift-ui", "MCP initialization failed");

  const listed = await call("tools/list");
  const tool = listed.result?.tools?.find((tool: { name: string }) =>
    tool.name === "convert_svg_to_swiftui"
  );
  assert(tool, "converter tool not listed");
  const inputSchema = tool.inputSchema;
  assert(inputSchema.properties?.svg?.maxLength === MAX_SVG_BYTES, "SVG schema limit missing");
  assert(inputSchema.required?.includes("svg"), "SVG must be required");
  for (const option of ["structName", "precision", "indentationSize", "usageCommentPrefix"]) {
    assert(inputSchema.properties?.[option], `${option} schema missing`);
    assert(!inputSchema.required?.includes(option), `${option} must be optional`);
  }
});

Deno.test("MCP converts SVG with explicit and default names", async () => {
  const call = createCaller(await createTestApp());
  for (
    const [arguments_, name] of [
      [{ svg, structName: "CircleIcon" }, "CircleIcon"],
      [{ svg }, "MyCustomShape"],
    ] as const
  ) {
    const converted = await call("tools/call", {
      name: "convert_svg_to_swiftui",
      arguments: arguments_,
    });
    assert(converted.result?.isError !== true, `${name} conversion returned an error`);
    assert(
      converted.result?.content?.some((item: { type: string; text?: string }) =>
        item.type === "text" && item.text?.includes(`struct ${name}: Shape`)
      ),
      `${name} conversion failed`,
    );
  }
});

Deno.test("MCP reports invalid inputs as tool errors", async () => {
  const call = createCaller(await createTestApp());
  for (
    const arguments_ of [
      { svg, precision: 101 },
      { svg, precision: 1.5 },
      { svg, indentationSize: -1 },
      { svg, indentationSize: 33 },
      { svg, usageCommentPrefix: "yes" },
      { svg, structName: "Bad-Name" },
      { svg: "not an svg" },
    ]
  ) {
    const invalid = await call("tools/call", {
      name: "convert_svg_to_swiftui",
      arguments: arguments_,
    });
    assert(
      invalid.result?.isError === true,
      `invalid input was accepted: ${JSON.stringify(arguments_)}`,
    );
  }
});

Deno.test("MCP route rejects oversized bodies and untrusted hosts", async () => {
  const app = await createTestApp();
  const tooLarge = await app.request("http://127.0.0.1:8000/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", host: "127.0.0.1:8000" },
    body: JSON.stringify({ svg: "x".repeat(MAX_REQUEST_BODY_BYTES) }),
  });
  assert(tooLarge.status === 413, "oversized HTTP body should be rejected");

  const rebinding = await app.request("http://untrusted.example/mcp", {
    method: "GET",
    headers: { host: "untrusted.example" },
  });
  assert(rebinding.status === 403, "untrusted Host should be rejected");
});
