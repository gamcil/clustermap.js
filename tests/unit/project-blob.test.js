import test from "node:test";
import assert from "node:assert/strict";
import { projectBlob } from "../../src/chart/projectBlob.mjs";

test("chunked project serialization matches JSON and owns its output", async () => {
  const data = { links: Array.from({ length: 1000 }, (_, i) => ({ uid: i, text: `gene ${i}`, identity: i / 1000 })),
    nested: [undefined, NaN, null, { skip: undefined, enabled: true }], text: "🧬" };
  const expected = JSON.stringify(data);
  const blob = projectBlob(data, { chunkSize: 128 });
  data.links[0].uid = -1;
  assert.equal(await blob.text(), expected);
  assert.equal(blob.type, "application/json;charset=utf-8");
});

test("project serialization rejects cycles, accessors and non-JSON objects", () => {
  const cycle = {}; cycle.self = cycle;
  assert.throws(() => projectBlob(cycle), /circular/);
  assert.throws(() => projectBlob({ get value() { throw new Error("must not execute"); } }), /accessors/);
  assert.throws(() => projectBlob({ value: new Date() }), /plain objects/);
  assert.throws(() => projectBlob({ value: 1n }), /BigInt/);
});
