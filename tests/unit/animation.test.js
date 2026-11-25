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
