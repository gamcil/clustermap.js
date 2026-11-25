import test from "node:test";
import assert from "node:assert/strict";
import { patchLinkRecords } from "../../src/scene/linkRecords.mjs";

test("link scene patches share unchanged records and preserve earlier frames and order", () => {
  const base = new Map(Array.from({ length: 12 }, (_, uid) => [uid, { uid, value: 0 }]));
  const first = patchLinkRecords(base, new Map([[5, { uid: 5, value: 1 }]]));
  const second = patchLinkRecords(first, new Map([[2, { uid: 2, value: 2 }]]));
  assert.equal(base.get(5).value, 0);
  assert.equal(first.get(2).value, 0);
  assert.equal(first.get(5).value, 1);
  assert.equal(second.get(5).value, 1);
  assert.equal(second.get(2).value, 2);
  assert.equal(second.get(8), base.get(8));
  assert.deepEqual([...second.keys()], [...base.keys()]);
  assert.deepEqual([...second.values()].map(({ uid }) => uid), [...base.keys()]);
  assert.equal(second.size, base.size);
  assert.throws(() => patchLinkRecords(second, new Map([[99, {}]])), /cannot add/);
  const compact = patchLinkRecords(second, new Map([[0, { uid: 0 }], [1, { uid: 1 }]]));
  assert.ok(compact instanceof Map);
  assert.equal(second.get(0), base.get(0));
  assert.deepEqual([...compact.keys()], [...base.keys()]);
});
