import { terser } from "rollup-plugin-terser";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";

const componentAssets = {
  name: "component-assets",
  async transform(code, id) {
    const pattern = /(?:await\s+)?textAsset\(new URL\((["'])([^"']+\.(?:html|css))\1,\s*import\.meta\.url\)\)/g;
    const assets = await Promise.all([...code.matchAll(pattern)].map(async ([expression, , path]) => {
      const filename = resolve(dirname(id), path); this.addWatchFile(filename);
      return [expression, JSON.stringify(await readFile(filename, "utf8"))];
    }));
    if (!assets.length) return null;
    for (const [expression, text] of assets) code = code.replace(expression, () => text);
    return { code, map: null };
  },
};

const stripTrailingWhitespace = {
  name: "strip-trailing-whitespace",
  renderChunk(code) {
    return { code: code.replace(/[ \t]+$/gm, ""), map: null };
  },
};

let annotationOverlayVersion;
const core = {
  input: "src/index.js",
  // The optional HTML editor loads on demand; share core geometry through its
  // factory argument instead of bundling a second layout/cache implementation.
  external: (id) => id === "../annotations/overlay.mjs",
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
  ].map((output) => ({ ...output, paths: (id) => id.endsWith("/annotations/overlay.mjs") ? `./annotationOverlay.mjs?v=${annotationOverlayVersion}` : id })),
  // Published modules bundle their D3 dependencies. Annotation controls are
  // the sole on-demand companion module; consumers need no global D3 runtime.
  plugins: [
    {
      name: "version-annotation-overlay",
      async buildStart() {
        const overlay = await readFile("dist/annotationOverlay.mjs");
        annotationOverlayVersion = createHash("sha256").update(overlay).digest("hex").slice(0, 12);
      },
    },
    componentAssets, nodeResolve({ browser: true }), stripTrailingWhitespace,
  ],
};

const editor = {
  input: {
    editor: "src/editor.js",
    "editor-data-panel": "src/editor/data-panel.js",
    "editor-appearance-panel": "src/editor/appearance-panel.js",
    annotationOverlay: "src/annotations/overlay.mjs",
  },
  output: { dir: "dist", format: "es", entryFileNames: "[name].mjs", chunkFileNames: "editor/[name]-[hash].mjs" },
  plugins: [
    { name: "clean-editor-chunks", buildStart: () => rm("dist/editor", { recursive: true, force: true }) },
    componentAssets, nodeResolve({ browser: true }), stripTrailingWhitespace,
  ],
};

// Build the optional UI first so the core imports its exact published version.
export default [editor, core];
