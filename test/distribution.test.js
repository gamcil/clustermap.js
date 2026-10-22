import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function bundleGraph(name, visited = new Set()) {
  const url = new URL(`../dist/${name}`, import.meta.url);
  if (visited.has(url.href)) return "";
  visited.add(url.href);
  const code = await readFile(url, "utf8");
  const imports = [...code.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+\.mjs)["']/g)].map(([, path]) => new URL(path, url));
  return code + (await Promise.all(imports.map((url) => bundleGraph(url.pathname.split("/dist/")[1], visited)))).join("\n");
}

test("published core and editor bundles do not require a consumer D3 shim", async () => {
  const [core, editor] = await Promise.all([
    bundleGraph("clustermap.mjs"),
    bundleGraph("editor.mjs"),
  ]);

  assert.doesNotMatch(core, /from\s*["']d3(?:-[^"']+)?["']/);
  assert.doesNotMatch(editor, /from\s*["']d3(?:-[^"']+)?["']/);
  assert.doesNotMatch(core, /global\.d3|require\(["']d3["']\)/);
  assert.doesNotMatch(editor, /textAsset\(|from\s*["'][^"']+\.(?:html|css)["']/);
  assert.match(editor, /clinker-editable-field/);
});
