import test from "node:test";
import assert from "node:assert/strict";

test("default configuration is recursively isolated per chart runtime", async () => {
  const { createDefaultConfig } = await import("../../src/chart/config.js");
  const first = createDefaultConfig();
  const second = createDefaultConfig();

  first.plot.transitionDuration = 0;
  first.link.label.position = 0.25;
  first.gene.shape.stroke = "red";
  first.colourBar.domain.min = 0.3;

  assert.equal(second.plot.transitionDuration, 250);
  assert.equal(second.link.label.position, 0.5);
  assert.equal(second.gene.shape.stroke, null);
  assert.equal(second.legend.position, "right");
  assert.equal(second.legend.marginTop, 20);
  assert.equal(second.legend.columns, 1);
  assert.equal(second.legend.columnWidth, 160);
  assert.equal(second.colourBar.domain.min, 0);
});

test("figure defaults resolve partial configs without changing explicit colours or source data", async () => {
  const { figureConfig } = await import("../../src/ui/theme.mjs");
  const config = { plot: { theme: "dark" }, gene: { shape: { stroke: "red", strokeWidth: 2 } } };
  const original = structuredClone(config);
  const resolved = figureConfig(config);
  assert.deepEqual(config, original);
  assert.equal(resolved.figureStyle.background, "#ffffff");
  assert.equal(resolved.figureStyle.foreground, "#000000");
  assert.deepEqual(resolved.gene.shape, { stroke: "red", strokeWidth: 2 });
  assert.equal(resolved.tree.branch.colour, "#555555");
  assert.equal(resolved.scaleBar.colour, "#000000");
  assert.equal(figureConfig(resolved), resolved);
  assert.equal(figureConfig({}).gene.shape.stroke, "#000000");
});
