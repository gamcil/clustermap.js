import test from "node:test";
import assert from "node:assert/strict";
import { createRasterInteraction } from "../src/rasterInteraction.mjs";

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
