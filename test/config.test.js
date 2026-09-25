import test from "node:test";
import assert from "node:assert/strict";

test("default configuration is recursively isolated per chart runtime", async () => {
  const { createDefaultConfig } = await import("../src/config.js");
  const first = createDefaultConfig();
  const second = createDefaultConfig();

  first.plot.transitionDuration = 0;
  first.link.label.position = 0.25;
  first.gene.shape.stroke = "red";

  assert.equal(second.plot.transitionDuration, 250);
  assert.equal(second.link.label.position, 0.5);
  assert.equal(second.gene.shape.stroke, "black");
  assert.equal(second.legend.position, "right");
  assert.equal(second.legend.marginTop, 20);
  assert.equal(second.legend.columns, 1);
  assert.equal(second.legend.columnWidth, 160);
});
