import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("published core and editor bundles do not require a consumer D3 shim", async () => {
  const readBundle = (name) => readFile(new URL(`../dist/${name}`, import.meta.url), "utf8");
  const [core, editor] = await Promise.all([
    readBundle("clustermap.mjs"),
    readBundle("editor.mjs"),
  ]);

  assert.doesNotMatch(core, /from\s*["']d3(?:-[^"']+)?["']/);
  assert.doesNotMatch(editor, /from\s*["']d3(?:-[^"']+)?["']/);
  assert.doesNotMatch(core, /global\.d3|require\(["']d3["']\)/);
});
