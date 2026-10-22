import { terser } from "rollup-plugin-terser";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const componentAssets = {
  name: "component-assets",
  async transform(code, id) {
    const pattern = /textAsset\(new URL\((["'])([^"']+\.(?:html|css))\1,\s*import\.meta\.url\)\)/g;
    const assets = await Promise.all([...code.matchAll(pattern)].map(async ([expression, , path]) => {
      const filename = resolve(dirname(id), path); this.addWatchFile(filename);
      return [expression, JSON.stringify(await readFile(filename, "utf8"))];
    }));
    if (!assets.length) return null;
    for (const [expression, text] of assets) code = code.replace(expression, () => text);
    return { code, map: null };
  },
};

const copyEditorCss = {
  name: "copy-editor-css",
  async writeBundle() {
    await mkdir("dist", { recursive: true });
    await writeFile("dist/editor.css", "/* Editor styles are included by the component imports. */\n");
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
  input: {
    editor: "src/editor.js",
    "editor-data-panel": "src/editor/data-panel.js",
    "editor-appearance-panel": "src/editor/appearance-panel.js",
    annotationOverlay: "src/annotationOverlay.mjs",
  },
  output: { dir: "dist", format: "es", entryFileNames: "[name].mjs", chunkFileNames: "editor/[name]-[hash].mjs" },
  plugins: [
    { name: "clean-editor-chunks", buildStart: () => rm("dist/editor", { recursive: true, force: true }) },
    componentAssets, nodeResolve({ browser: true }), stripTrailingWhitespace,
  ],
};

export default [core, editor];
