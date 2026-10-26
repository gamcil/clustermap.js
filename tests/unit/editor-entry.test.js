import test from "node:test";
import assert from "node:assert/strict";

test("the optional editor entry can be imported outside a browser", async () => {
  const editor = await import("../../src/editor.js");
  assert.deepEqual(Object.keys(editor), ["mountPlotSelectionToolbar"]);
});
