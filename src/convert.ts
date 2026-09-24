import { convert, type SwiftUIGeneratorConfig } from "svg-to-swiftui-core";
import * as v from "valibot";
import { svgBytesSchema } from "./validation.ts";

export function convertSvg(svg: string, config: SwiftUIGeneratorConfig): string {
  v.parse(svgBytesSchema, svg);

  // The published 0.4.0 package exposes convert(), not the repository's newer diagnostics APIs.
  return convert(svg, config);
}
