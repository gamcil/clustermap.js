const test = require("node:test");
const assert = require("node:assert/strict");

test("large demo fixture is deterministic and dense enough to exercise viewport culling", async () => {
  const { createLargeTestingData } = await import("../largeTestingData.mjs");
  const data = createLargeTestingData();

  assert.equal(data.clusters.length, 100);
  assert.equal(data.clusters.flatMap((cluster) => cluster.loci[0].genes).length, 10000);
  assert.equal(data.links.length, 9900);
  assert.equal(data.groups.length, 10);
  assert.equal(data.config.updateGroups, false);
  assert.equal(new Set(data.links.map((link) => link.uid)).size, data.links.length);
});
