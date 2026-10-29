import test from "node:test";
import assert from "node:assert/strict";
import { animate, afterPaint } from "../../src/renderers/animation.mjs";

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
