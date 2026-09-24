import * as v from "valibot";

export const MAX_REQUEST_BODY_BYTES = 300 * 1024;
export const MAX_SVG_BYTES = 256 * 1024;

const encoder = new TextEncoder();

export const svgBytesSchema = v.pipe(
  v.string(),
  v.check(
    (svg) => encoder.encode(svg).length <= MAX_SVG_BYTES,
    `SVG must not exceed ${MAX_SVG_BYTES} bytes`,
  ),
);

export const toolInputSchema = v.object({
  svg: v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(MAX_SVG_BYTES),
    v.description("Complete SVG markup, including the <svg> root"),
  ),
  structName: v.optional(
    v.pipe(
      v.string(),
      v.regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
      v.maxLength(64),
      v.description("Swift type name to generate"),
    ),
    "MyCustomShape",
  ),
  precision: v.optional(v.pipe(
    v.number(),
    v.integer(),
    v.minValue(0),
    v.maxValue(100),
    v.description("Decimal places for path coordinates (0–100); omit for library default"),
  )),
  indentationSize: v.optional(v.pipe(
    v.number(),
    v.integer(),
    v.minValue(0),
    v.maxValue(32),
    v.description("Spaces per indentation level (0–32); omit for library default"),
  )),
  usageCommentPrefix: v.optional(v.pipe(
    v.boolean(),
    v.description("Include a SwiftUI usage comment before the generated Shape"),
  )),
});

export const portSchema = v.pipe(
  v.string(),
  v.regex(/^[0-9]+$/),
  v.transform(Number),
  v.integer(),
  v.minValue(1),
  v.maxValue(65535),
);
