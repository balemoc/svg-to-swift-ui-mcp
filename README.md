# SVG to SwiftUI MCP

A local [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that converts
complete inline SVG markup into SwiftUI `Shape` source. It exposes one tool,
`convert_svg_to_swiftui`, over Streamable HTTP. The converter is the published
[`svg-to-swiftui-core@0.4.0`](https://www.npmjs.com/package/svg-to-swiftui-core/v/0.4.0) package;
features described on that project's current `main` branch may not be available in this release.

## Getting started

Install [mise](https://mise.jdx.dev/) and, from the repository root, run:

```sh
mise install
cp .env.example .env
mise exec -- deno task start
```

`mise.toml` pins Deno 2.7.14. The start task loads the required local `.env` file (ignored by Git);
edit `PORT` there to change the port. On first run, Deno needs access to the npm registry to fill
its package cache. The server listens at `http://127.0.0.1:8000/mcp` by default. Configure a
Streamable HTTP MCP client to connect to that URL. Clients using the 2026-07-28 protocol discover
the server with `server/discover`; older clients can use the legacy `initialize` handshake. Set
either `HOST` or `PORT` to change the bind address (the omitted value keeps its default):

```sh
HOST=127.0.0.1 PORT=8787 mise exec -- deno task start
```

`HOST` must be nonempty with no whitespace; `PORT` is parsed as a number and must resolve to an
integer from 1 to 65535.

Run the JSR package with Deno instead of cloning the repository:

```sh
deno run --allow-net --allow-env=HOST,PORT jsr:@balemoc/svg-to-swift-ui-mcp@0.1.0
```

The endpoint, `HOST`, and `PORT` behavior are the same. Deno must be installed, and the first run
needs network access to download the package and its dependencies.

## Tool: `convert_svg_to_swiftui`

Pass complete SVG markup, including the `<svg>` root. The tool returns generated SwiftUI source as
text; invalid options or conversion failures produce an MCP tool error.

| Argument             | Required | Description                                                                                                               |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `svg`                | Yes      | Nonempty inline SVG markup, up to 256 KiB encoded as UTF-8.                                                               |
| `structName`         | No       | Generated Swift type name; defaults to `MyCustomShape`. Must match `[A-Za-z_][A-Za-z0-9_]*` and be at most 64 characters. |
| `precision`          | No       | Integer decimal precision, 0–100; otherwise uses the converter default.                                                   |
| `indentationSize`    | No       | Integer spaces per indentation level, 0–32; otherwise uses the converter default.                                         |
| `usageCommentPrefix` | No       | Boolean controlling whether a SwiftUI usage comment precedes the generated Shape; otherwise uses the converter default.   |

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

Omit optional arguments to use their defaults. The result contains a SwiftUI `Shape` definition, not
a rendered image or a SwiftUI `View`.

## Architecture and limits

- `src/validation.ts` validates and defaults the bind address; `src/index.ts` starts the Hono
  server.
- `src/mcp.ts` registers the tool and serves modern and legacy MCP requests at `/mcp`.
- `src/tools/convert_svg_to_swiftui.ts` checks SVG input size and calls `svg-to-swiftui-core`.
- `tests/server_test.ts` calls the tool over a live loopback server and checks conversion, invalid
  input, and HTTP request protections.

HTTP request bodies are limited to 300 KiB and SVG input to 256 KiB. Generated SwiftUI output is not
size-limited. The tool accepts inline SVG only: it does not accept file paths or URL inputs. The
start task grants Deno network access and permission to read only the `HOST` and `PORT` environment
variables.

By default this is a **local-only service**. Setting `HOST` to a non-loopback address exposes the
unauthenticated endpoint to reachable networks; use a secure authenticated tunnel for remote access.

## Development

Direct dependencies are pinned in `deno.json`, with the resolved graph in `deno.lock`. Run the
checks before submitting changes:

```sh
mise exec -- deno task check  # type-check, format check, lint
mise exec -- deno task test   # Deno tests
```

When changing tool behavior, update the tests in `tests/` and keep the argument schema in
`src/validation.ts` consistent with the converter options.

## Publishing

The package is configured as `@balemoc/svg-to-swift-ui-mcp` in `deno.json`. Before the first
release, create the package in the `@balemoc` scope on JSR and link it to this GitHub repository for
[OIDC publishing](https://jsr.io/docs/publishing-packages#publishing-from-github-actions). The
[publish workflow](.github/workflows/publish.yml) runs checks and a publish dry run before
publishing on a pushed `v*` tag. The tag must match the `deno.json` version (for example, `v0.1.0`).
Review locally with `mise exec -- deno publish --dry-run` before tagging.

## License

This project is licensed under the [MIT License](LICENSE).
