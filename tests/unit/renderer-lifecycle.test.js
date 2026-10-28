import test from "node:test";
import assert from "node:assert/strict";
import { createRendererLifecycle } from "../../src/renderers/lifecycle.mjs";

test("renderer switches release shared fallback resources without resetting repeated paints", () => {
  const events = [];
  const lifecycle = createRendererLifecycle({
    svg: { paint: () => events.push("svg") },
    canvas: { paint: () => events.push("canvas"), destroy: () => events.push("release canvas") },
    webgpu: { paint: (request) => { events.push(request); return request; }, destroy: () => events.push("release gpu") },
  });
  const first = {}, next = {};
  assert.equal(lifecycle.paint("webgpu", first), first);
  assert.equal(lifecycle.paint("webgpu", next), next);
  assert.deepEqual(events, [first, next]);
  lifecycle.paint("svg", {});
  assert.deepEqual(events.slice(2), ["release canvas", "release gpu", "svg"]);
  lifecycle.destroy();
  assert.deepEqual(events.slice(-2), ["release canvas", "release gpu"]);
  events.length = 0;
  lifecycle.paint("canvas", {});
  assert.deepEqual(events, ["canvas"], "a destroyed lifecycle can mount again");
});

test("an invalid renderer does not release the active backend", () => {
  let released = 0;
  const lifecycle = createRendererLifecycle({
    canvas: { paint: () => "painted", destroy: () => released++ },
  });
  lifecycle.select("canvas");
  assert.throws(() => lifecycle.select("unknown"), /Unknown renderer/);
  assert.equal(lifecycle.paint("canvas", {}), "painted");
  assert.equal(released, 0);
});
