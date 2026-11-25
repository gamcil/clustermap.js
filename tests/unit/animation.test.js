import test from "node:test";
import assert from "node:assert/strict";
import { animate, afterPaint } from "../../src/renderers/animation.mjs";
import { interpolateScene } from "../../src/scene/preview.mjs";

test("scene animation reuses links invisible at both endpoints while preserving fades", () => {
  const anchors = [0, 1, 0, 0, 1, 10];
  const invisible = { source: { uid: "hidden" }, visible: false, anchors: null };
  const entering = { source: { uid: "entering", query: { uid: "q" } }, visible: true, anchors };
  const leaving = { source: { uid: "leaving", query: { uid: "q" } }, visible: false, anchors: null };
  const base = { loci: new Map(), clusters: new Map(), genes: new Map() };
  const previous = { ...base, links: new Map([["hidden", { ...invisible }],
    ["entering", { ...entering, visible: false, anchors: null }],
    ["leaving", { ...leaving, visible: true, anchors }]]) };
  const next = { ...base, links: new Map([["hidden", invisible], ["entering", entering], ["leaving", leaving]]) };
  const frame = interpolateScene(previous, next, 0.5);
  assert.equal(frame.links.get("hidden"), invisible);
  assert.equal(frame.links.get("entering").opacity, 0.5);
  assert.equal(frame.links.get("leaving").opacity, 0.5);
  assert.equal(frame.links.get("entering").visible, true);
  assert.equal(frame.links.get("leaving").visible, true);
});

test("indexed animation visits only links with endpoint geometry and keeps painter order", () => {
  const anchors = [0, 1, 0, 0, 1, 10];
  const records = new Map(Array.from({ length: 100 }, (_, uid) => [uid,
    { source: { uid, query: { uid: "q" } }, order: uid, visible: false, anchors: null }]));
  const oldLinks = new Map(records), newLinks = new Map(records);
  oldLinks.set(2, { ...records.get(2), visible: true, anchors });
  newLinks.set(8, { ...records.get(8), visible: true, anchors });
  let reads = 0;
  const target = { get: (uid) => { reads++; return newLinks.get(uid); }, keys: () => { throw new Error("scanned all links"); },
    [Symbol.iterator]: () => newLinks[Symbol.iterator](), size: newLinks.size, has: (uid) => newLinks.has(uid) };
  const empty = { loci: new Map(), clusters: new Map(), genes: new Map() };
  const previous = { ...empty, links: oldLinks, index: { links: { boundsById: new Map([[2, {}]]) } } };
  const next = { ...empty, links: target, index: { links: { boundsById: new Map([[8, {}]]) } } };
  const frame = interpolateScene(previous, next, 0.5);
  assert.ok(reads <= 4, "only candidate links are accessed");
  assert.equal(frame.links.get(2).opacity, 0.5);
  assert.equal(frame.links.get(8).opacity, 0.5);
  assert.equal(frame.links.get(50), records.get(50));
  assert.deepEqual(frame.animationLinkIds, [2, 8]);
  assert.deepEqual([...frame.links].map(([uid]) => uid), [...records.keys()]);
});

test("cancelled animation work stays inert even after its callback was dequeued", (t) => {
  const frames = new Map();
  let serial = 0;
  for (const [name, value] of Object.entries({
    requestAnimationFrame: (callback) => { frames.set(++serial, callback); return serial; },
    cancelAnimationFrame: (id) => frames.delete(id),
  })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name]);
  }
  t.mock.method(performance, "now", () => 0);
  const dequeue = () => { const callback = frames.values().next().value; frames.clear(); return callback; };
  const fail = () => assert.fail("cancelled callback ran");
  const cancelAnimation = animate(100, fail, fail);
  const tick = dequeue();
  cancelAnimation(); tick(100);
  const cancelFirstFrame = afterPaint(fail), first = dequeue();
  cancelFirstFrame(); first();
  assert.equal(frames.size, 0, "cancelled preparation cannot queue its second frame");
  const cancelSecondFrame = afterPaint(fail);
  dequeue()();
  const second = dequeue();
  cancelSecondFrame(); second();
  assert.equal(frames.size, 0);
});
