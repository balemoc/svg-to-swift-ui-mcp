import config from "../deno.json" with { type: "json" };

export const packageName = config.name;
export const packageVersion = config.version;
