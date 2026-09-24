import { convert } from "svg-to-swiftui-core";

export const MAX_SVG_BYTES = 256 * 1024;
export const MAX_SWIFT_BYTES = 1024 * 1024;
const encoder = new TextEncoder();

export function convertSvg(svg: string, structName: string): string {
  if (encoder.encode(svg).length > MAX_SVG_BYTES) {
    throw new Error(`SVG must not exceed ${MAX_SVG_BYTES} bytes`);
  }

  // The published 0.4.0 package exposes convert(), not the repository's newer diagnostics APIs.
  const swift = convert(svg, { structName });
  if (encoder.encode(swift).length > MAX_SWIFT_BYTES) {
    throw new Error(`Generated Swift exceeds ${MAX_SWIFT_BYTES} bytes`);
  }
  return swift;
}
