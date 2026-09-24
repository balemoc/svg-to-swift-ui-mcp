import assert from "node:assert/strict";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { Hono } from "hono";
import { createMcpRoute } from "../src/mcp.ts";
import { MAX_REQUEST_BODY_BYTES } from "../src/validation.ts";

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';

Deno.test("live MCP server converts SVG and rejects invalid requests", async () => {
  const app = new Hono();
  app.route("/mcp", createMcpRoute());
  const server = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen: () => {} }, app.fetch);
  const url = new URL(`http://127.0.0.1:${(server.addr as Deno.NetAddr).port}/mcp`);
  const client = new Client(
    { name: "integration-test", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );

  try {
    await client.connect(new StreamableHTTPClientTransport(url));
    const tools = await client.listTools();
    assert(tools.tools.some((tool) => tool.name === "convert_svg_to_swiftui"));

    const converted = await client.callTool({
      name: "convert_svg_to_swiftui",
      arguments: { svg, structName: "CircleIcon" },
    });
    assert.equal(converted.isError, undefined);
    assert(
      converted.content.some((item) =>
        item.type === "text" && item.text.includes("struct CircleIcon: Shape")
      ),
    );

    const defaultName = await client.callTool({
      name: "convert_svg_to_swiftui",
      arguments: { svg },
    });
    assert(
      defaultName.content.some((item) =>
        item.type === "text" && item.text.includes("struct MyCustomShape: Shape")
      ),
    );

    for (
      const arguments_ of [
        { svg: "not an svg" },
        { svg, structName: "Bad-Name" },
        { svg, precision: 101 },
      ]
    ) {
      const invalid = await client.callTool({
        name: "convert_svg_to_swiftui",
        arguments: arguments_,
      });
      assert.equal(invalid.isError, true);
    }

    const tooLarge = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ svg: "x".repeat(MAX_REQUEST_BODY_BYTES) }),
    });
    assert.equal(tooLarge.status, 413);
    await tooLarge.body?.cancel();

    const untrustedOrigin = await fetch(url, { headers: { origin: "http://untrusted.example" } });
    assert.equal(untrustedOrigin.status, 403);
    await untrustedOrigin.body?.cancel();
  } finally {
    await client.close();
    await server.shutdown();
  }
});
