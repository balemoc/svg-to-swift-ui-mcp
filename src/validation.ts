import * as v from "valibot";

export const MAX_REQUEST_BODY_BYTES = 300 * 1024;

const envSchema = v.object({
  hostname: v.optional(
    v.pipe(v.string(), v.regex(/^\S+$/, "HOST must be a nonempty hostname or IP address")),
    "127.0.0.1",
  ),
  port: v.optional(
    v.pipe(
      v.string(),
      v.transform(Number),
      v.integer("PORT must be an integer between 1 and 65535"),
      v.minValue(1, "PORT must be an integer between 1 and 65535"),
      v.maxValue(65535, "PORT must be an integer between 1 and 65535"),
    ),
    "8000",
  ),
});

export function parseEnv() {
  return v.parse(envSchema, {
    hostname: Deno.env.get("HOST"),
    port: Deno.env.get("PORT"),
  });
}

export const env = parseEnv();
