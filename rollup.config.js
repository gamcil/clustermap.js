import { terser } from "rollup-plugin-terser";
import { copyFile, mkdir } from "node:fs/promises";

const copyEditorCss = {
  name: "copy-editor-css",
  async writeBundle() {
    await mkdir("dist", { recursive: true });
    await copyFile("src/editor/editor.css", "dist/editor.css");
  },
};

const core = {
  input: "src/index.js",
  external: ["d3"],
  output: [
    {
      file: "dist/clustermap.mjs",
      format: "es",
    },
    {
      file: "dist/clustermap.js",
      format: "umd",
      name: "ClusterMap",
      globals: { d3: "d3" },
    },
    {
      file: "dist/clustermap.min.js",
      format: "umd",
      name: "ClusterMap",
      plugins: [terser()],
      globals: { d3: "d3" },
    },
  ],
  plugins: [copyEditorCss],
};

const editor = {
  input: "src/editor.js",
  external: ["d3"],
  output: { file: "dist/editor.mjs", format: "es" },
};

export default [core, editor];
