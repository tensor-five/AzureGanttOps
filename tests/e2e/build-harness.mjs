import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFilePath), "..", "..");

await build({
  entryPoints: [path.join(projectRoot, "tests/e2e/runtime-harness.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["chrome120"],
  outfile: path.join(projectRoot, "tests/e2e/runtime-harness.js"),
  sourcemap: false,
  logLevel: "silent"
});
