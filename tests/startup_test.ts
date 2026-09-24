const runArgs = ["run", "--allow-net=127.0.0.1", "--allow-env=PORT", "src/index.ts"];

Deno.test("entry point serves MCP on the configured port", async () => {
  const reservation = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (reservation.addr as Deno.NetAddr).port;
  reservation.close();

  const child = new Deno.Command(Deno.execPath(), {
    args: runArgs,
    env: { PORT: String(port) },
    stdout: "null",
    stderr: "null",
  }).spawn();
  try {
    let response: Response | undefined;
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        response = await fetch(`http://127.0.0.1:${port}/mcp`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2026-07-28",
              capabilities: {},
              clientInfo: { name: "startup-test", version: "1.0.0" },
            },
          }),
        });
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    if (!response) throw new Error(`Server did not start on port ${port}`);
    const body = await response.text();
    if (response.status !== 200 || !body.includes("svg-to-swift-ui")) {
      throw new Error(`MCP initialization failed: ${response.status} ${body}`);
    }
  } finally {
    child.kill();
    await child.status;
  }
});

Deno.test("entry point rejects invalid ports", async () => {
  for (const value of ["0", "65536", "1.5", "abc"]) {
    const result = await new Deno.Command(Deno.execPath(), {
      args: runArgs,
      env: { PORT: value },
      stdout: "null",
      stderr: "piped",
    }).output();
    const error = new TextDecoder().decode(result.stderr);
    if (result.success || !error.includes("PORT must be an integer between 1 and 65535")) {
      throw new Error(`PORT=${value} was not rejected: ${error}`);
    }
  }
});
