import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultConfig, mergeConfig, configurationEffects } from "../../src/chart/config.js";

test("configuration effects separate presentation, geometry and link filtering", () => {
  const before = createDefaultConfig();
  const effects = (patch) => configurationEffects(before, mergeConfig(before, patch));
  assert.deepEqual(effects({ tree: { width: 200, leafGuide: { show: true } }, cluster: { labelAlignment: "left" } }),
    { presentationOnly: true, clusterLabels: true, refilterLinks: false });
  assert.deepEqual(effects({ cluster: { spacing: 70 } }),
    { presentationOnly: false, clusterLabels: false, refilterLinks: false });
  assert.deepEqual(effects({ link: { threshold: 0.7 } }),
    { presentationOnly: false, clusterLabels: false, refilterLinks: true });
  assert.deepEqual(effects({ link: { bestOnly: true }, tree: { show: false } }),
    { presentationOnly: false, clusterLabels: false, refilterLinks: true });
  assert.deepEqual(configurationEffects(before, { ...before, tree: { ...before.tree, leafGuide: { ...before.tree.leafGuide, future: true } } }),
    { presentationOnly: false, clusterLabels: false, refilterLinks: true });
  assert.deepEqual(configurationEffects(before, { ...before, future: true }),
    { presentationOnly: false, clusterLabels: false, refilterLinks: true });
});
