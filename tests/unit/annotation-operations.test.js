import test from "node:test";
import assert from "node:assert/strict";
import { applyChartOperations } from "../../src/data/operations.mjs";
import { createChartIndex } from "../../src/data/index.mjs";

const fixture = () => ({ clusters: ["a", "b", "c"].map((uid) => ({ uid, loci: [] })), links: [], groups: [],
  annotationPanels: [{ uid: "heat", type: "heatmap", title: "Values", columns: ["One", "Two"],
    values: { a: [1, null], b: [2, 3] } },
    { uid: "bar", type: "bar", columns: ["Count"], values: { a: [1] } }] });
const patch = (data, operations) => applyChartOperations(data, createChartIndex(data), operations);
const rows = (values) => ({ type: "annotationPanels.updateRows", uid: "heat", values });

test("annotation row edits share untouched rows and retain only edited rows in history", () => {
  const data = fixture(), [panel, other] = data.annotationPanels, values = { a: [4, 5], c: [null, null] };
  const result = patch(data, [rows(values)]);
  const edited = data.annotationPanels[0];
  assert.notEqual(edited, panel);
  assert.equal(edited.values.b, panel.values.b);
  assert.equal(data.annotationPanels[1], other);
  assert.deepEqual(result.inverse, [rows({ a: [1, null], c: null })]);
  values.a[0] = 99;
  assert.equal(edited.values.a[0], 4, "operation inputs are owned by the caller");
  result.operations[0].values.a[0] = 88;
  assert.equal(edited.values.a[0], 4, "recorded operations do not alias live values");
  patch(data, result.inverse);
  assert.deepEqual(data.annotationPanels, [panel, other]);
  assert.equal(Object.hasOwn(data.annotationPanels[0].values, "c"), false);
});

test("annotation row removal and repeated edits round trip through undo and redo", () => {
  const data = fixture(), original = structuredClone(data);
  const result = patch(data, [rows({ a: null }), rows({ a: [7, 8], b: null }), rows({ a: [9, 10] })]);
  const edited = structuredClone(data);
  const undo = patch(data, result.inverse);
  assert.deepEqual(data, original);
  patch(data, undo.inverse);
  assert.deepEqual(data, edited);
});

test("annotation row batches validate atomically, including removed IDs and changed shapes", () => {
  for (const values of [{ missing: null }, { a: [1] }, { a: [NaN, 0] }, { a: ["wrong", 0] }, { a: {} }]) {
    const data = fixture(), original = structuredClone(data);
    assert.throws(() => patch(data, [rows({ a: [4, 5] }), rows(values)]), TypeError);
    assert.deepEqual(data, original);
  }
  const data = fixture();
  patch(data, [rows({ a: [4] }), { type: "annotationPanels.update", ids: ["heat"],
    changes: { columns: ["Single"], values: { a: [6] } } }]);
  assert.deepEqual(data.annotationPanels[0].values, { a: [6] });
});

test("annotation row validation rechecks retained rows when category rules change", () => {
  const data = fixture();
  data.annotationPanels[0].scale = { type: "categorical", domain: ["Yes", "No"] };
  data.annotationPanels[0].values = { a: ["Yes", "No"], b: ["No", null] };
  const original = structuredClone(data);
  assert.throws(() => patch(data, [rows({ a: ["Yes", null] }), {
    type: "annotationPanels.update", ids: ["heat"], changes: { scale: { type: "categorical", domain: ["Yes"] } },
  }]), /absent from scale.domain/);
  assert.deepEqual(data, original);
  const result = patch(data, [rows({ a: ["Yes", null], b: null }), {
    type: "annotationPanels.update", ids: ["heat"], changes: { scale: { type: "categorical", domain: ["Yes"] } },
  }]);
  patch(data, result.inverse);
  assert.deepEqual(data, original);
});

test("annotation row edits compose with creation, style changes and bar panels", () => {
  const data = fixture(), original = structuredClone(data);
  const result = patch(data, [{ type: "annotationPanels.create", panel: {
    uid: "new", type: "bar", columns: ["Count"], values: {},
  } }, { type: "annotationPanels.updateRows", uid: "new", values: { c: [8] } },
  { type: "annotationPanels.update", ids: ["heat"], changes: { title: "Edited" } }, rows({ c: [6, 7] })]);
  patch(data, result.inverse);
  assert.deepEqual(data, original);
});
