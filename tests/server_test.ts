import assert from "node:assert/strict";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { packageName, packageVersion } from "../src/meta.ts";
import { mcpApp } from "../src/mcp.ts";
import { MAX_SVG_BYTES } from "../src/tools/convert_svg_to_swiftui.schema.ts";
import { MAX_REQUEST_BODY_BYTES } from "../src/validation.ts";

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';

Deno.test("live MCP server converts SVG and rejects invalid requests", async () => {
  const server = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen: () => {} }, mcpApp.fetch);
  const url = new URL(`http://127.0.0.1:${(server.addr as Deno.NetAddr).port}/mcp`);
  const client = new Client(
    { name: "integration-test", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );

  try {
    await client.connect(new StreamableHTTPClientTransport(url));
    assert.deepEqual(client.getServerVersion(), { name: packageName, version: packageVersion });
    const tools = await client.listTools();
    assert(tools.tools.some((tool) => tool.name === "convert_svg_to_swiftui"));

    const converted = await client.callTool({
      name: "convert_svg_to_swiftui",
      arguments: { svg, structName: "CircleIcon" },
    });
    assert.equal(converted.isError, false);
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

    const oversizedSvg = await client.callTool({
      name: "convert_svg_to_swiftui",
      arguments: { svg: "é".repeat(MAX_SVG_BYTES / 2 + 1) },
    });
    assert.equal(oversizedSvg.isError, true);
    assert(
      oversizedSvg.content.some((item) =>
        item.type === "text" && item.text.includes("SVG must not exceed")
      ),
    );

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
