import assert from "node:assert/strict";
import { parseEnv } from "../src/validation.ts";

Deno.test("parseEnv reads HOST and PORT with independent defaults and rejects invalid values", () => {
  const originalHost = Deno.env.get("HOST");
  const originalPort = Deno.env.get("PORT");
  try {
    Deno.env.delete("HOST");
    Deno.env.delete("PORT");
    assert.deepEqual(parseEnv(), { hostname: "127.0.0.1", port: 8000 });

    Deno.env.set("HOST", "localhost");
    assert.deepEqual(parseEnv(), { hostname: "localhost", port: 8000 });
    Deno.env.delete("HOST");
    Deno.env.set("PORT", "8787");
    assert.deepEqual(parseEnv(), { hostname: "127.0.0.1", port: 8787 });
    Deno.env.set("HOST", "::1");
    Deno.env.set("PORT", "65535");
    assert.deepEqual(parseEnv(), { hostname: "::1", port: 65535 });

    Deno.env.delete("PORT");
    for (const host of ["", " bad", "bad host"]) {
      Deno.env.set("HOST", host);
      assert.throws(() => parseEnv(), /HOST must be/);
    }
    Deno.env.delete("HOST");
    for (const port of ["", "0", "65536", "1.5", "abc"]) {
      Deno.env.set("PORT", port);
      assert.throws(() => parseEnv(), /PORT must be/);
    }
  } finally {
    if (originalHost === undefined) Deno.env.delete("HOST");
    else Deno.env.set("HOST", originalHost);
    if (originalPort === undefined) Deno.env.delete("PORT");
    else Deno.env.set("PORT", originalPort);
  }
});
