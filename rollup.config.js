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
  // The optional HTML editor loads on demand; share core geometry through its
  // factory argument instead of bundling a second layout/cache implementation.
  external: (id) => id === "./annotationOverlay.mjs",
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
  // Published modules bundle their D3 dependencies. Annotation controls are
  // the sole on-demand companion module; consumers need no global D3 runtime.
  plugins: [nodeResolve({ browser: true }), stripTrailingWhitespace, copyEditorCss],
};

const editor = {
  input: "src/editor.js",
  output: { file: "dist/editor.mjs", format: "es" },
  plugins: [nodeResolve({ browser: true }), stripTrailingWhitespace],
};

const annotationUi = {
  input: "src/annotationOverlay.mjs",
  output: { file: "dist/annotationOverlay.mjs", format: "es" },
  plugins: [nodeResolve({ browser: true }), stripTrailingWhitespace],
};

export default [core, editor, annotationUi];
