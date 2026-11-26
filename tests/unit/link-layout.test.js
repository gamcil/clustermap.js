import test from "node:test";
import assert from "node:assert/strict";

test("link endpoints project genes and biological spans through locus flips and trims", async () => {
  const { projectLinkEndpoint } = await import("../../src/links/layout.mjs");
  const locus = { source: { uid: "l", start: 0, end: 100, bio: { start: 1000, end: 1100 } },
    cluster: { uid: "c" }, x: 10, y: 30, track: { y: 5 }, state: { start: 0, end: 100, flipped: false } };
  const gene = { locus, visible: true, display: { start: 20, end: 30, strand: -1 } };
  const options = { genes: new Map([["g", gene]]), loci: new Map([["l", locus]]), scaleX: (x) => x };
  assert.deepEqual(projectLinkEndpoint({ uid: "g" }, options).anchors, [40, 30, 35]);
  const span = { kind: "span", locusId: "l", start: 1020, end: 1040 };
  assert.deepEqual(projectLinkEndpoint(span, options).anchors, [30, 50, 35]);
  locus.state.flipped = true;
  assert.deepEqual(projectLinkEndpoint(span, options).anchors, [90, 70, 35]);
  locus.state.start = 70;
  assert.equal(projectLinkEndpoint(span, options).visible, false);
  assert.equal(projectLinkEndpoint(span, { ...options, scaleGenes: false }), null);
});

test("link anchors retain endpoint orientation when ordered by row", async () => {
  const { orderLinkAnchors, getLinkLabelPosition } = await import("../../src/links/layout.mjs");
  const anchors = orderLinkAnchors([35, 45, 42], [25, 15, 12]);
  assert.deepEqual(anchors, [25, 15, 12, 35, 45, 42]);
  assert.deepEqual(getLinkLabelPosition(anchors, 0.5), { x: 30, y: 27 });
});

test("link layout produces paths for ribbons and lines", async () => {
  const { getLinkPath, sampleLinkGeometry, traceLinkPath } = await import("../../src/links/layout.mjs");
  const anchors = [10, 20, 5, 30, 40, 25];

  assert.equal(
    getLinkPath(anchors, { asLine: false, straight: true }),
    "M10,5L20,5L40,25L30,25L10,5Z"
  );
  assert.equal(
    getLinkPath(anchors, { asLine: false, straight: false }),
    "M20,5C20,15,40,15,40,25L30,25C30,15,10,15,10,5Z"
  );
  assert.equal(
    getLinkPath(anchors, { asLine: true, straight: true }),
    "M15,5L35,25"
  );
  assert.equal(
    getLinkPath(anchors, { asLine: true, straight: false }),
    "M15,5C15,15,35,15,35,25"
  );

  assert.deepEqual(
    sampleLinkGeometry(anchors, { asLine: false, straight: true }),
    { asLine: false, upper: [[20, 5], [40, 25]], lower: [[10, 5], [30, 25]], line: [] }
  );
  assert.deepEqual(
    sampleLinkGeometry(anchors, { asLine: true, straight: false, segments: 2 }).line,
    [[15, 5], [25, 15], [35, 25]]
  );

  const commands = [];
  traceLinkPath({
    moveTo: (...values) => commands.push(["M", ...values]),
    lineTo: (...values) => commands.push(["L", ...values]),
    bezierCurveTo: (...values) => commands.push(["C", ...values]),
    closePath: () => commands.push(["Z"]),
  }, anchors, { asLine: false, straight: true });
  assert.deepEqual(commands, [["M", 10, 5], ["L", 20, 5], ["L", 40, 25], ["L", 30, 25], ["L", 10, 5], ["Z"]]);
});
