# SVG to SwiftUI MCP

Local Streamable HTTP MCP server built with Deno and Hono. One tool, `convert_svg_to_swiftui`,
accepts complete inline SVG and optional `structName`, `precision`, `indentationSize`, and
`usageCommentPrefix` options, returning SwiftUI source as text. It uses the published
`svg-to-swiftui-core@0.4.0` package (a Shape converter); features documented on the upstream
repository's current `main` branch are not necessarily in that release.

## Run

```sh
mise install
mise exec -- deno task start
# Or choose another loopback port:
PORT=8787 mise exec -- deno task start
```

Connect an HTTP MCP client to `http://127.0.0.1:8000/mcp` (or the chosen `PORT`). The server rejects
ports outside 1–65535 or non-integer values. It binds to loopback only. If your client runs on
another machine, use a secure authenticated tunnel; do not expose this service directly to the
internet.

Example tool arguments:

```json
{
  "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\"/></svg>",
  "structName": "CircleIcon",
  "precision": 8,
  "indentationSize": 4,
  "usageCommentPrefix": false
}
```

Omit optional settings to use the converter's defaults. `precision` accepts integers from 0 to 100
(the JavaScript `toFixed` range); `indentationSize` accepts integers from 0 to 32 to bound output
size.

Requests are limited to 300 KiB, SVG input to 256 KiB, and generated output to 1 MiB. The tool
accepts inline SVG only: it does not read local files or fetch external URLs. Deno is granted only
loopback network access and permission to read only `PORT` from the environment.

## Develop

```sh
mise exec -- deno task check
mise exec -- deno task test
```

`mise.toml` pins the Deno runtime; `deno.json` pins direct dependencies and `deno.lock` pins their
resolved graph. The first run needs access to the npm registry to populate Deno's package cache.
