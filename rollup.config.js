import { terser } from "rollup-plugin-terser";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { copyFile, mkdir } from "node:fs/promises";

const copyEditorCss = {
  name: "copy-editor-css",
  async writeBundle() {
    await mkdir("dist", { recursive: true });
    await copyFile("src/editor/editor.css", "dist/editor.css");
  },
};

const stripTrailingWhitespace = {
  name: "strip-trailing-whitespace",
  renderChunk(code) {
    return { code: code.replace(/[ \t]+$/gm, ""), map: null };
  },
};

const core = {
  input: "src/index.js",
  output: [
    {
      file: "dist/clustermap.mjs",
      format: "es",
    },
    {
      file: "dist/clustermap.js",
      format: "umd",
      name: "ClusterMap",
    },
    {
      file: "dist/clustermap.min.js",
      format: "umd",
      name: "ClusterMap",
      plugins: [terser()],
    },
  ],
  // The published chart is self-contained. Consumers may still use D3 to
  // mount its callable chart, but do not need to resolve or globally expose
  // D3 for the chart or optional editor to load.
  plugins: [nodeResolve({ browser: true }), stripTrailingWhitespace, copyEditorCss],
};

const editor = {
  input: "src/editor.js",
  output: { file: "dist/editor.mjs", format: "es" },
  plugins: [nodeResolve({ browser: true }), stripTrailingWhitespace],
};

export default [core, editor];
