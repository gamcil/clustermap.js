import test from "node:test";
import assert from "node:assert/strict";
import { createRasterInteraction } from "../../src/interaction/raster.mjs";

for (const [action, kind, coordinate, edge] of [
  ["move-cluster", "ClusterDrag", "y"],
  ["move-locus", "LocusDrag", "x"],
  ["trim-locus-left", "LocusTrim", "x", "left"],
  ["trim-locus-right", "LocusTrim", "x", "right"],
]) {
  test(`raster ${action} shares drag threshold, commit and click cancellation`, () => {
    const calls = [], handlers = new Map();
    const interactions = Object.fromEntries(["begin", "move", "end", "cancel"].map((stage) =>
      [`${stage}${kind}`, (...args) => calls.push([stage, ...args])]));
    const target = { action, locusUid: "locus", clusterUid: "cluster" };
    let captured = false;
    const surface = {
      setPointerCapture() { captured = true; }, hasPointerCapture: () => captured,
      releasePointerCapture() { captured = false; },
    };
    const selection = {
      node: () => surface,
      on(names, handler) { for (const name of names.split(" ")) handlers.set(name, handler); return this; },
    };
    const controller = createRasterInteraction({
      targetForEvent: () => target, worldPoint: (_surface, event) => ({ x: event.clientX, y: event.clientY }),
      locusForTarget: () => "locus", setHoverLocus: () => false,
      beginMotion: () => calls.push(["motion"]), endMotion: () => calls.push(["settle"]),
      interactions, actions: {},
    });
    const dispose = controller.bind(selection);
    const pointer = (name, x, y) => handlers.get(`${name}.canvasInteraction`).call(surface,
      { pointerId: 1, button: 0, clientX: x, clientY: y, preventDefault() {} });
    pointer("pointerdown", 10, 20);
    pointer("pointermove", 10.5, 20.5);
    assert.equal(calls.length, 1, "sub-threshold motion does not update the plot");
    pointer("pointermove", 15, 25);
    pointer("pointerup", 15, 25);
    assert.deepEqual(calls, [
      edge ? ["begin"] : ["begin", coordinate === "y" ? "cluster" : "locus", coordinate === "y" ? 20 : 10],
      ["motion"], edge ? ["move", "locus", edge, 15] : ["move", coordinate === "y" ? 25 : 15],
      edge ? ["end", "locus"] : ["end"], ["settle"],
    ]);
    assert.equal(captured, false);
    calls.length = 0;
    pointer("pointerdown", 10, 20);
    pointer("pointerup", 10, 20);
    assert.deepEqual(calls.at(-1), ["cancel"]);
    assert.equal(calls.length, 2, "clicks cancel without starting motion");
    dispose();
  });
}

test("raster bindings persist on one surface and release listeners when replaced", () => {
  const listeners = new Map(), calls = [];
  const windowRef = {
    addEventListener(type, listener) { listeners.set(type, listener); calls.push(`add:${type}`); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); calls.push(`remove:${type}`); },
  };
  const makeSurface = () => {
    const node = { ownerDocument: { defaultView: windowRef } }, handlers = new Map();
    return { node: () => node, handlers,
      on(name, handler) { handlers.set(name, handler); return this; } };
  };
  const first = makeSurface(), second = makeSurface();
  const controller = createRasterInteraction({ interactions: {}, actions: {} });
  const disposeFirst = controller.bind(first);
  const keydown = listeners.get("keydown"), pointerdown = first.handlers.get("pointerdown.canvasInteraction");
  assert.equal(controller.bind(first), disposeFirst);
  assert.equal(listeners.get("keydown"), keydown);
  assert.equal(first.handlers.get("pointerdown.canvasInteraction"), pointerdown);
  assert.equal(calls.length, 2);
  const disposeSecond = controller.bind(second);
  assert.deepEqual(calls, ["add:keydown", "add:keyup", "remove:keydown", "remove:keyup", "add:keydown", "add:keyup"]);
  disposeFirst();
  assert.equal(listeners.size, 2, "an old disposer does not detach a new surface");
  disposeSecond(); disposeSecond();
  assert.equal(listeners.size, 0);
  assert.equal(calls.length, 8, "disposal is idempotent");
  const rebound = controller.bind(second);
  disposeSecond();
  assert.equal(listeners.size, 2, "an old disposer cannot detach a rebound surface");
  rebound();
  assert.equal(listeners.size, 0);
});
