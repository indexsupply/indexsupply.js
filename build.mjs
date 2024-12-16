import dts from "bun-plugin-dts";

await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "node",
  format: "esm",
  plugins: [dts()],
});
await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist/browser",
  target: "browser",
  format: "esm",
});
