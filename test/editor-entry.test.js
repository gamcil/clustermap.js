import test from "node:test";
import assert from "node:assert/strict";

test("the optional editor entry can be imported outside a browser", async () => {
  const editor = await import("../src/editor.js");
  assert.equal(typeof editor.defineClinkerEditor, "function");
  assert.equal(typeof editor.ClinkerEditorElement, "function");
  assert.throws(() => editor.defineClinkerEditor(), /Custom elements are unavailable/);
});
