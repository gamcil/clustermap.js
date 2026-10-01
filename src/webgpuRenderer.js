// Deliberately small, direct WebGPU renderer for the renderer-neutral scene.
// It owns only dense geometric marks; Canvas/SVG remain responsible for text,
// chrome, interaction affordances, export, and broad-browser fallback.

import { color } from "d3";
import { sampleLinkGeometry } from "./links/layout.mjs";
import {
  clusterOffsetForPreview,
  geneVisibleForPreview,
  locusGeometryForPreview,
  locusOffsetForPreview,
  previewOffsetsForLocus,
} from "./scenePreview.mjs";
import { clusterPairKey } from "./layout.mjs";

const shader = /* wgsl */ `
struct Camera {
  transform: vec4f,
  viewport: vec2f,
  // vec4 alignment leaves two padding floats after viewport.
  // asLine, straight, stroke width, reserved.
  linkStyle: vec4f,
}
@group(0) @binding(0) var<uniform> camera: Camera;
struct ClusterOffsets {
  values: array<vec2f>,
}
@group(0) @binding(1) var<storage, read> clusterOffsets: ClusterOffsets;
struct LinkRecord {
  query: vec4f,
  mate: vec4f,
  fill: vec4f,
  stroke: vec4f,
}
struct LinkRecords {
  values: array<LinkRecord>,
}
struct LinkIndices {
  values: array<u32>,
}
@group(0) @binding(2) var<storage, read> linkRecords: LinkRecords;
@group(0) @binding(3) var<storage, read> linkIndices: LinkIndices;

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) colour: vec4f,
  @location(2) clusterSlot: f32,
}
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) colour: vec4f,
}

struct StrokeInput {
  @location(0) first: vec2f,
  @location(1) second: vec2f,
  @location(2) colour: vec4f,
  @location(3) clusterSlot: f32,
  @location(4) width: f32,
}

@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  let clusterOffset = clusterOffsets.values[u32(input.clusterSlot)];
  let screen = (input.position + clusterOffset)
    * camera.transform.z + camera.transform.xy;
  var output: VertexOutput;
  output.position = vec4f(
    screen.x / camera.viewport.x * 2.0 - 1.0,
    1.0 - screen.y / camera.viewport.y * 2.0,
    0.0,
    1.0
  );
  output.colour = input.colour;
  return output;
}

// WebGPU line-list primitives are always one *physical* pixel wide. Draw
// gene outlines as quads instead so their configured stroke width matches
// Canvas and SVG at every device-pixel ratio and camera scale.
fn projectStroke(
  worldFirst: vec2f,
  worldSecond: vec2f,
  width: f32,
  corner: u32,
  colour: vec4f,
) -> VertexOutput {
  let first = worldFirst * camera.transform.z + camera.transform.xy;
  let second = worldSecond * camera.transform.z + camera.transform.xy;
  let delta = second - first;
  let segmentLength = max(length(delta), 0.0001);
  let direction = delta / segmentLength;
  let normal = vec2f(-direction.y, direction.x);
  let halfWidth = width * camera.transform.z / 2.0;
  let useSecond = corner == 1u || corner == 2u || corner == 4u;
  let positiveSide = corner == 2u || corner == 4u || corner == 5u;
  // Extending each endpoint by half a stroke joins adjacent edge quads at
  // polygon corners without a CPU-side miter calculation.
  let point = select(first - direction * halfWidth, second + direction * halfWidth, useSecond);
  let screen = point + normal * select(-halfWidth, halfWidth, positiveSide);
  var output: VertexOutput;
  output.position = vec4f(
    screen.x / camera.viewport.x * 2.0 - 1.0,
    1.0 - screen.y / camera.viewport.y * 2.0,
    0.0,
    1.0
  );
  output.colour = colour;
  return output;
}

@vertex fn strokeVertex(
  input: StrokeInput,
  @builtin(vertex_index) vertexIndex: u32,
) -> VertexOutput {
  let clusterOffset = clusterOffsets.values[u32(input.clusterSlot)];
  return projectStroke(
    input.first + clusterOffset,
    input.second + clusterOffset,
    input.width,
    vertexIndex % 6u,
    input.colour,
  );
}

@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return input.colour;
}

fn cubic(start: f32, controlA: f32, controlB: f32, end: f32, amount: f32) -> f32 {
  let inverse = 1.0 - amount;
  return inverse * inverse * inverse * start +
    3.0 * inverse * inverse * amount * controlA +
    3.0 * inverse * amount * amount * controlB +
    amount * amount * amount * end;
}

fn ribbonPoint(link: LinkRecord, edge: u32, amount: f32) -> vec2f {
  let queryOffset = clusterOffsets.values[u32(link.query.w)];
  let mateOffset = clusterOffsets.values[u32(link.mate.w)];
  let queryY = link.query.z + queryOffset.y;
  let mateY = link.mate.z + mateOffset.y;
  let queryIsTop = queryY <= mateY;
  let top = select(link.mate, link.query, queryIsTop);
  let bottom = select(link.query, link.mate, queryIsTop);
  let topY = select(mateY, queryY, queryIsTop);
  let bottomY = select(queryY, mateY, queryIsTop);
  let topOffset = select(mateOffset.x, queryOffset.x, queryIsTop);
  let bottomOffset = select(queryOffset.x, mateOffset.x, queryIsTop);
  let topX = select(top.x, top.y, edge == 0u) + topOffset;
  let bottomX = select(bottom.x, bottom.y, edge == 0u) + bottomOffset;
  let middle = topY + abs(bottomY - topY) / 2.0;
  if (camera.linkStyle.y > 0.5) {
    return vec2f(
      mix(topX, bottomX, amount),
      mix(topY, bottomY, amount)
    );
  }
  return vec2f(
    cubic(topX, topX, bottomX, bottomX, amount),
    cubic(topY, middle, middle, bottomY, amount)
  );
}

fn linkCentrePoint(link: LinkRecord, amount: f32) -> vec2f {
  let queryOffset = clusterOffsets.values[u32(link.query.w)];
  let mateOffset = clusterOffsets.values[u32(link.mate.w)];
  let queryX = (link.query.x + link.query.y) / 2.0 + queryOffset.x;
  let mateX = (link.mate.x + link.mate.y) / 2.0 + mateOffset.x;
  let queryY = link.query.z + queryOffset.y;
  let mateY = link.mate.z + mateOffset.y;
  if (camera.linkStyle.y > 0.5) {
    return vec2f(mix(queryX, mateX, amount), mix(queryY, mateY, amount));
  }
  let middle = queryY + abs(mateY - queryY) / 2.0;
  return vec2f(
    cubic(queryX, queryX, mateX, mateX, amount),
    cubic(queryY, middle, middle, mateY, amount)
  );
}

fn projectWorld(point: vec2f, colour: vec4f) -> VertexOutput {
  let screen = point * camera.transform.z + camera.transform.xy;
  var output: VertexOutput;
  output.position = vec4f(
    screen.x / camera.viewport.x * 2.0 - 1.0,
    1.0 - screen.y / camera.viewport.y * 2.0,
    0.0,
    1.0
  );
  output.colour = colour;
  return output;
}

@vertex fn linkFillVertex(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let link = linkRecords.values[linkIndices.values[instanceIndex]];
  if (camera.linkStyle.x > 0.5) {
    return projectWorld(linkCentrePoint(link, 0.0), vec4f(link.fill.rgb, 0.0));
  }
  let segment = vertexIndex / 6u;
  let corner = vertexIndex % 6u;
  let start = f32(segment) / 10.0;
  let end = f32(segment + 1u) / 10.0;
  var edge = 0u;
  var amount = start;
  if (corner == 1u || corner == 3u) {
    amount = end;
  } else if (corner == 4u) {
    edge = 1u;
    amount = end;
  } else if (corner == 2u || corner == 5u) {
    edge = 1u;
  }
  return projectWorld(ribbonPoint(link, edge, amount), link.fill);
}

@vertex fn linkEdgeVertex(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let link = linkRecords.values[linkIndices.values[instanceIndex]];
  let segment = vertexIndex / 6u;
  let corner = vertexIndex % 6u;
  if (camera.linkStyle.x > 0.5) {
    if (segment >= 10u) {
      return projectWorld(linkCentrePoint(link, 0.0), vec4f(link.stroke.rgb, 0.0));
    }
    return projectStroke(
      linkCentrePoint(link, f32(segment) / 10.0),
      linkCentrePoint(link, f32(segment + 1u) / 10.0),
      camera.linkStyle.z,
      corner,
      link.stroke,
    );
  }
  if (segment < 10u) {
    return projectStroke(
      ribbonPoint(link, 0u, f32(segment) / 10.0),
      ribbonPoint(link, 0u, f32(segment + 1u) / 10.0),
      camera.linkStyle.z,
      corner,
      link.stroke,
    );
  }
  if (segment < 20u) {
    return projectStroke(
      ribbonPoint(link, 1u, f32(segment - 10u) / 10.0),
      ribbonPoint(link, 1u, f32(segment - 9u) / 10.0),
      camera.linkStyle.z,
      corner,
      link.stroke,
    );
  }
  if (segment == 20u) {
    return projectStroke(ribbonPoint(link, 0u, 0.0), ribbonPoint(link, 1u, 0.0), camera.linkStyle.z, corner, link.stroke);
  }
  return projectStroke(ribbonPoint(link, 0u, 1.0), ribbonPoint(link, 1u, 1.0), camera.linkStyle.z, corner, link.stroke);
}`;

function rgba(value, fallback = [0.6, 0.6, 0.6, 1]) {
  const colour = color(value);
  return colour
    ? [colour.r / 255, colour.g / 255, colour.b / 255, colour.opacity ?? 1]
    : fallback;
}

function pushVertex(vertices, x, y, colour, clusterSlot = 0) {
  vertices.push(x, y, ...colour, clusterSlot);
}

function pushTriangle(vertices, first, second, third, colour, clusterSlot = 0) {
  pushVertex(vertices, first[0], first[1], colour, clusterSlot);
  pushVertex(vertices, second[0], second[1], colour, clusterSlot);
  pushVertex(vertices, third[0], third[1], colour, clusterSlot);
}

function pushStrokeSegment(vertices, first, second, colour, clusterSlot, width) {
  vertices.push(...first, ...second, ...colour, clusterSlot, width);
}

function pushGene(
  vertices,
  edges,
  gene,
  colour,
  points = gene.polygon,
  stroke = [0, 0, 0, 1],
  clusterSlot = 0,
  strokeWidth = 1
) {
  if (points.length !== 14) return;
  const point = (index) => [points[index * 2], points[index * 2 + 1]];
  // The seven-point gene arrow is concave at its shaft/arrow junction. This
  // fixed triangulation matches the Canvas/SVG polygon without a general
  // triangulation dependency.
  for (const triangle of [[0, 1, 6], [1, 5, 6], [1, 2, 5], [2, 4, 5], [2, 3, 4]]) {
    pushTriangle(vertices, point(triangle[0]), point(triangle[1]), point(triangle[2]), colour, clusterSlot);
  }
  for (let index = 0; index < 7; index += 1) {
    pushStrokeSegment(
      edges,
      point(index),
      point((index + 1) % 7),
      stroke,
      clusterSlot,
      strokeWidth
    );
  }
}

function pushLink(vertices, edges, link, colour, stroke, {
  visible = link.visible,
  anchors = link.anchors,
  segments = 10,
  asLine = false,
  straight = false,
  strokeWidth = 1,
} = {}) {
  if (!visible || !anchors) return;
  const geometry = sampleLinkGeometry(anchors, { asLine, straight, segments });
  const strokeSegment = (first, second) => pushStrokeSegment(
    edges, first, second, stroke, 0, strokeWidth
  );
  if (asLine) {
    for (let index = 1; index < geometry.line.length; index += 1) {
      strokeSegment(geometry.line[index - 1], geometry.line[index]);
    }
    return;
  }
  for (let index = 0; index < geometry.upper.length - 1; index += 1) {
    pushTriangle(vertices, geometry.upper[index], geometry.upper[index + 1], geometry.lower[index], colour);
    pushTriangle(vertices, geometry.upper[index + 1], geometry.lower[index + 1], geometry.lower[index], colour);
    strokeSegment(geometry.upper[index], geometry.upper[index + 1]);
    strokeSegment(geometry.lower[index], geometry.lower[index + 1]);
  }
  strokeSegment(geometry.upper[0], geometry.lower[0]);
  strokeSegment(geometry.upper.at(-1), geometry.lower.at(-1));
}

function offsetsForLocus(preview, locus) {
  return previewOffsetsForLocus(preview, locus);
}

function polygonForPreview(preview, gene) {
  const { x, y } = offsetsForLocus(preview, gene.locus);
  // Cluster-drag offsets are applied by the vertex shader. Keep only the
  // locus-local x adjustment in these retained gene coordinates.
  const bakedY = preview?.type === "cluster-drag" ? 0 : y;
  const axis = preview?.type === "locus-flip"
    ? preview.axes?.get(gene.locus.source.uid)
    : undefined;
  if (!x && !y && axis === undefined) return gene.polygon;
  const scale = axis === undefined ? 1 : 1 - 2 * preview.progress;
  return gene.polygon.map((coordinate, index) =>
    index % 2
      ? coordinate + bakedY
      : (axis === undefined ? coordinate : axis + (coordinate - axis) * scale) + x
  );
}

function anchorsForPreview(scene, link, preview) {
  if (!preview) return link.anchors;
  const query = scene.genes.get(link.source.query.uid);
  const target = scene.genes.get(link.source.target.uid);
  if (!query || !target) return null;
  const anchorForGene = (gene) => {
    const offsets = offsetsForLocus(preview, gene.locus);
    const forward = gene.display.strand === 1;
    const minX = gene.bounds.minX + offsets.x;
    const maxX = gene.bounds.maxX + offsets.x;
    const axis = preview?.type === "locus-flip"
      ? preview.axes?.get(gene.locus.source.uid)
      : undefined;
    if (axis !== undefined) {
      const progress = preview.progress;
      const targetMin = axis * 2 - maxX;
      const targetMax = axis * 2 - minX;
      const from = forward ? [minX, maxX] : [maxX, minX];
      const to = forward ? [targetMax, targetMin] : [targetMin, targetMax];
      return [
        from[0] + (to[0] - from[0]) * progress,
        from[1] + (to[1] - from[1]) * progress,
        gene.locus.y + gene.locus.track.y + offsets.y,
      ];
    }
    return [
      forward ? minX : maxX,
      forward ? maxX : minX,
      gene.locus.y + gene.locus.track.y + offsets.y,
    ];
  };
  const queryAnchor = anchorForGene(query);
  const targetAnchor = anchorForGene(target);
  return queryAnchor[2] <= targetAnchor[2]
    ? [...queryAnchor, ...targetAnchor]
    : [...targetAnchor, ...queryAnchor];
}

function linkVisibleForPreview(scene, link, preview, config) {
  if (!preview) return link.visible;
  const query = scene.genes.get(link.source.query.uid);
  const target = scene.genes.get(link.source.target.uid);
  if (!query || !target) return false;
  if (!geneVisibleForPreview(preview, query) || !geneVisibleForPreview(preview, target)) return false;
  if (preview?.type !== "cluster-drag") return link.visible;
  const queryOrder = preview.clusterOrder.get(query.locus.cluster.uid);
  const targetOrder = preview.clusterOrder.get(target.locus.cluster.uid);
  return (
    queryOrder !== undefined &&
    targetOrder !== undefined &&
    Math.abs(queryOrder - targetOrder) === 1 &&
    link.allowed &&
    link.source.identity >= config.link.threshold
  );
}

function trackForPreview(preview, locus) {
  return preview?.loci?.get(locus.source.uid)?.track || locus.track;
}

function transparent(colour) {
  return [colour[0], colour[1], colour[2], 0];
}

function geneVertices(gene, scales, preview = null, clusterSlot = 0, strokeWidth = 1) {
  const fill = [];
  const edge = [];
  const visible = geneVisibleForPreview(preview, gene);
  const colour = rgba(gene.source.colour || scales.colour(scales.group(gene.source.uid)));
  pushGene(
    fill,
    edge,
    gene,
    visible ? colour : transparent(colour),
    polygonForPreview(preview, gene),
    visible ? [0, 0, 0, 1] : [0, 0, 0, 0],
    clusterSlot,
    strokeWidth
  );
  return { genes: new Float32Array(fill), geneEdges: new Float32Array(edge) };
}

function linkVertices(scene, link, scales, config, preview = null) {
  const fill = [];
  const edge = [];
  const visible = linkVisibleForPreview(scene, link, preview, config);
  const colour = rgba(
    link.source.colour || (config.link.groupColour
      ? scales.colour(scales.group(link.source.query.uid))
      : scales.score(link.source.identity))
  );
  const stroke = rgba(
    link.source.colour || (config.link.groupColour
      ? scales.colour(scales.group(link.source.query.uid))
      : "black")
  );
  pushLink(fill, edge, link, visible ? colour : transparent(colour), visible ? stroke : transparent(stroke), {
    // Records with a range were visible in the retained base scene. Keeping
    // their vertex count constant lets a preview hide them by alpha alone.
    visible: true,
    anchors: anchorsForPreview(scene, link, preview),
    asLine: config.link.asLine,
    straight: config.link.straight,
    strokeWidth: config.link.strokeWidth,
  });
  return { links: new Float32Array(fill), linkEdges: new Float32Array(edge) };
}

function linkEndpointForGpu(gene, clusterSlot, offsetX = 0) {
  const forward = gene.display.strand === 1;
  return [
    (forward ? gene.bounds.minX : gene.bounds.maxX) - offsetX,
    (forward ? gene.bounds.maxX : gene.bounds.minX) - offsetX,
    gene.locus.y + gene.locus.track.y,
    clusterSlot,
  ];
}

function linkRecordForGpu(scene, link, scales, config, clusterSlots, clusterOffsetX = () => 0) {
  const query = scene.genes.get(link.source.query.uid);
  const target = scene.genes.get(link.source.target.uid);
  if (!query || !target) return null;
  const fill = rgba(
    link.source.colour || (config.link.groupColour
      ? scales.colour(scales.group(link.source.query.uid))
      : scales.score(link.source.identity))
  );
  const stroke = rgba(
    link.source.colour || (config.link.groupColour
      ? scales.colour(scales.group(link.source.query.uid))
      : "black")
  );
  return new Float32Array([
    ...linkEndpointForGpu(
      query,
      clusterSlots.get(query.locus.cluster.uid),
      clusterOffsetX(query.locus.cluster.uid)
    ),
    ...linkEndpointForGpu(
      target,
      clusterSlots.get(target.locus.cluster.uid),
      clusterOffsetX(target.locus.cluster.uid)
    ),
    ...fill,
    ...stroke,
  ]);
}

function buildLinkRecords(scene, scales, config, clusterSlots) {
  const values = [];
  const indexByUid = new Map();
  for (const link of scene.links.values()) {
    const record = linkRecordForGpu(scene, link, scales, config, clusterSlots);
    if (!record) continue;
    indexByUid.set(link.source.uid, indexByUid.size);
    values.push(...record);
  }
  return { values: new Float32Array(values), indexByUid };
}

function trackVertices(locus, config, preview = null, clusterSlot = 0) {
  const geometry = locusGeometryForPreview(preview, locus);
  const { x, y: previewY } = geometry.offsets || { x: 0, y: 0 };
  const y = preview?.type === "cluster-drag" ? 0 : previewY;
  const track = geometry.track || locus.track;
  const vertices = [];
  pushStrokeSegment(
    vertices,
    [locus.x + track.x1 + x, locus.y + track.y + y],
    [locus.x + track.x2 + x, locus.y + track.y + y],
    rgba(config.locus.trackBar.colour, [0.07, 0.07, 0.07, 1]),
    clusterSlot,
    config.locus.trackBar.stroke
  );
  return new Float32Array(vertices);
}

function append(target, values) {
  const range = { offset: target.length, length: values.length };
  target.push(...values);
  return range;
}

function translateVertexX(values, offsetX) {
  if (!offsetX) return values;
  const translated = new Float32Array(values);
  for (let index = 0; index < translated.length; index += 7) {
    translated[index] -= offsetX;
  }
  return translated;
}

function buildGeometry(scene, scales, config, preview = null, clusterSlots = null) {
  const links = [];
  const genes = [];
  const linkEdges = [];
  const geneEdges = [];
  const tracks = [];
  const ranges = { links: new Map(), genes: new Map(), loci: new Map() };
  const slots = clusterSlots || new Map(
    [...scene.clusters.keys()].map((uid, index) => [uid, index + 1])
  );
  for (const link of scene.links.values()) {
    // A preview never introduces a link that was absent from the base scene.
    if (!link.visible) continue;
    const vertices = linkVertices(scene, link, scales, config, preview);
    ranges.links.set(link.source.uid, {
      links: append(links, vertices.links),
      linkEdges: append(linkEdges, vertices.linkEdges),
    });
  }
  for (const gene of scene.genes.values()) {
    // Trimming only hides base-visible genes, so their range is stable too.
    if (!gene.visible) continue;
    const vertices = geneVertices(
      gene,
      scales,
      preview,
      slots.get(gene.locus.cluster.uid),
      config.gene.shape.strokeWidth
    );
    ranges.genes.set(gene.source.uid, {
      genes: append(genes, vertices.genes),
      geneEdges: append(geneEdges, vertices.geneEdges),
    });
  }
  for (const locus of scene.loci.values()) {
    ranges.loci.set(locus.source.uid, {
      tracks: append(tracks, trackVertices(locus, config, preview, slots.get(locus.cluster.uid))),
    });
  }
  return {
    data: {
      links: new Float32Array(links),
      linkEdges: new Float32Array(linkEdges),
      tracks: new Float32Array(tracks),
      genes: new Float32Array(genes),
      geneEdges: new Float32Array(geneEdges),
    },
    ranges,
    clusterSlots: slots,
  };
}

function viewportForCamera(camera, width, height, overscan = 20) {
  const margin = overscan / camera.k;
  return {
    minX: -camera.x / camera.k - margin,
    maxX: (width - camera.x) / camera.k + margin,
    minY: -camera.y / camera.k - margin,
    maxY: (height - camera.y) / camera.k + margin,
  };
}

function boundsInViewport(bounds, viewport, offsetY = 0) {
  return (
    bounds.minX <= viewport.maxX &&
    bounds.maxX >= viewport.minX &&
    bounds.minY + offsetY <= viewport.maxY &&
    bounds.maxY + offsetY >= viewport.minY
  );
}

function visibleClusterPreviewPairs(scene, preview, viewport) {
  const clusters = [];
  const clusterUidByOrder = new Map(
    [...preview.clusterOrder].map(([uid, order]) => [order, uid])
  );
  for (const cluster of scene.clusters.values()) {
    if (boundsInViewport(cluster.bounds, viewport, clusterOffsetForPreview(preview, cluster.source.uid))) {
      clusters.push(cluster);
    }
  }
  const pairs = new Set();
  for (const cluster of clusters) {
    const order = preview.clusterOrder.get(cluster.source.uid);
    for (const neighbourOrder of [order - 1, order + 1]) {
      const neighbourUid = clusterUidByOrder.get(neighbourOrder);
      if (neighbourUid === undefined) continue;
      pairs.add(clusterPairKey(cluster.source.uid, neighbourUid));
    }
  }
  return pairs;
}

function recordsForPreview(scene, preview) {
  if (!preview) return null;
  if (preview.type === "cluster-drag") {
    return {
      // Genes, tracks, and instanced link ribbons all resolve their row
      // offsets on the GPU, leaving only a compact visible-link index list to
      // upload while the pointer moves.
      loci: new Set(),
      genes: new Set(),
      links: new Set(),
      full: false,
      clusterOffsets: true,
    };
  }
  const loci = new Set();
  if (preview.type === "locus-offset") loci.add(preview.locusUid);
  if (preview.type === "locus-offsets") {
    for (const locusUid of preview.locusOffsets.keys()) loci.add(locusUid);
  }
  if (preview.type === "locus-flip") loci.add(preview.locusUid);
  if (preview.type === "locus-trim") {
    const trimmed = scene.loci.get(preview.locusUid);
    const clusterUid = trimmed?.cluster.uid;
    // getLocusScaleValues packs loci independently within each cluster. A
    // trim can therefore shift every sibling locus even when its individual
    // offset happens to be zero in a particular preview frame.
    for (const locus of scene.loci.values()) {
      if (locus.cluster.uid === clusterUid) loci.add(locus.source.uid);
    }
  }
  const genes = new Set();
  for (const gene of scene.genes.values()) {
    if (loci.has(gene.locus.source.uid)) genes.add(gene.source.uid);
  }
  const links = new Set();
  for (const link of scene.links.values()) {
    if (genes.has(link.source.query.uid) || genes.has(link.source.target.uid)) {
      links.add(link.source.uid);
    }
  }
  return { loci, genes, links, full: false };
}

function bufferFor(device, existing, data) {
  if (!data.byteLength) return null;
  if (!existing || existing.size < data.byteLength) {
    existing?.destroy();
    existing = device.createBuffer({
      size: Math.max(data.byteLength, 4),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  }
  device.queue.writeBuffer(existing, 0, data);
  return existing;
}

/** Create an opt-in direct WebGPU renderer for dense scene geometry. */
export async function createWebGpuRenderer(canvas) {
  if (!globalThis.navigator?.gpu) return null;
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  if (!context) return null;
  const format = navigator.gpu.getPreferredCanvasFormat();
  const module = device.createShaderModule({ code: shader });
  // Browser implementations are allowed to defer WGSL validation until a
  // pipeline is created, which otherwise produces an unhelpful “pipeline is
  // invalid” message. Surface compiler locations and let clusterMap use its
  // established Canvas fallback instead.
  const diagnostics = await module.getCompilationInfo();
  const errors = diagnostics.messages.filter((message) => message.type === "error");
  if (errors.length) {
    throw new Error(
      `WebGPU shader compilation failed:\n${errors
        .map((message) => `line ${message.lineNum}:${message.linePos} ${message.message}`)
        .join("\n")}`
    );
  }
  const vertexBuffers = [{
    arrayStride: 28,
    attributes: [
      { shaderLocation: 0, offset: 0, format: "float32x2" },
      { shaderLocation: 1, offset: 8, format: "float32x4" },
      { shaderLocation: 2, offset: 24, format: "float32" },
    ],
  }];
  const strokeVertexBuffers = [{
    // first.xy, second.xy, colour.rgba, cluster slot, world-space stroke width
    arrayStride: 40,
    attributes: [
      { shaderLocation: 0, offset: 0, format: "float32x2" },
      { shaderLocation: 1, offset: 8, format: "float32x2" },
      { shaderLocation: 2, offset: 16, format: "float32x4" },
      { shaderLocation: 3, offset: 32, format: "float32" },
      { shaderLocation: 4, offset: 36, format: "float32" },
    ],
    stepMode: "instance",
  }];
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      { binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
    ],
  });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
  const target = [{
    format,
    blend: {
      color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
    },
  }];
  const createPipeline = device.createRenderPipelineAsync
    ? (descriptor) => device.createRenderPipelineAsync(descriptor)
    : (descriptor) => Promise.resolve(device.createRenderPipeline(descriptor));
  const pipeline = await createPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vertexMain", buffers: vertexBuffers },
    fragment: { module, entryPoint: "fragmentMain", targets: target },
    primitive: { topology: "triangle-list" },
  });
  const strokePipeline = await createPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "strokeVertex", buffers: strokeVertexBuffers },
    fragment: { module, entryPoint: "fragmentMain", targets: target },
    primitive: { topology: "triangle-list" },
  });
  const linkPipeline = await createPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "linkFillVertex" },
    fragment: { module, entryPoint: "fragmentMain", targets: target },
    primitive: { topology: "triangle-list" },
  });
  const linkLinePipeline = await createPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "linkEdgeVertex" },
    fragment: { module, entryPoint: "fragmentMain", targets: target },
    primitive: { topology: "line-list" },
  });
  const uniform = device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  let clusterOffsetBuffer = device.createBuffer({
    size: 8,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  let clusterOffsetCapacity = 1;
  // Each cluster owns a world-space x/y translation. Reusing this tiny
  // buffer lets committed cluster moves avoid rebuilding every gene vertex.
  let clusterBaseOffsets = new Float32Array(clusterOffsetCapacity * 2);
  let linkRecordBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  let linkRecordCapacity = 0;
  let linkIndexBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  let linkIndexCapacity = 1;
  const createBindGroup = () => device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniform } },
      { binding: 1, resource: { buffer: clusterOffsetBuffer } },
      { binding: 2, resource: { buffer: linkRecordBuffer } },
      { binding: 3, resource: { buffer: linkIndexBuffer } },
    ],
  });
  let bindGroup = createBindGroup();
  let linkBuffer = null;
  let linkEdgeBuffer = null;
  let trackBuffer = null;
  let geneBuffer = null;
  let geneEdgeBuffer = null;
  let linkCount = 0;
  let linkEdgeCount = 0;
  let previewLinkCount = 0;
  let previewLinksActive = false;
  let retainedClusterGeometry = false;
  let linkRecordIndexByUid = new Map();
  let clusterPreviewIndexCache = new Map();
  let trackCount = 0;
  let geneCount = 0;
  let geneEdgeCount = 0;
  let scene = null;
  let preview = null;
  let geometry = null;
  let patchedRecords = null;
  let configured = false;

  const resizeStorageBuffer = (buffer, capacity, values) => {
    if (values.byteLength <= capacity * 4) return { buffer, capacity, resized: false };
    buffer.destroy();
    return {
      buffer: device.createBuffer({
        size: Math.max(values.byteLength, 4),
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      capacity: Math.ceil(values.byteLength / 4),
      resized: true,
    };
  };

  const uploadLinkRecords = (records) => {
    const resized = resizeStorageBuffer(linkRecordBuffer, linkRecordCapacity, records.values);
    linkRecordBuffer = resized.buffer;
    linkRecordCapacity = resized.capacity;
    if (records.values.byteLength) device.queue.writeBuffer(linkRecordBuffer, 0, records.values);
    linkRecordIndexByUid = records.indexByUid;
    clusterPreviewIndexCache = new Map();
    bindGroup = createBindGroup();
  };

  const clusterPreviewLinkIndices = (nextPreview, viewport, config) => {
    const pairs = visibleClusterPreviewPairs(scene, nextPreview, viewport);
    const cacheKey = `${config.link.threshold}:${[...pairs].sort().join("|")}`;
    const cached = clusterPreviewIndexCache.get(cacheKey);
    if (cached) return cached;
    // The scene already indexes links by cluster pair. Build the GPU list from
    // those selected pairs, rather than scanning every link and recomputing
    // its pair key whenever the dragged row crosses a snap boundary.
    const indices = [];
    for (const pair of pairs) {
      for (const uid of scene.linksByClusterPair?.get(pair) || []) {
        const link = scene.links.get(uid);
        const query = link && scene.genes.get(link.source.query.uid);
        const target = link && scene.genes.get(link.source.target.uid);
        const index = link && linkRecordIndexByUid.get(link.source.uid);
        if (
          query?.visible &&
          target?.visible &&
          link.allowed &&
          link.source.identity >= config.link.threshold &&
          index !== undefined
        ) {
          indices.push(index);
        }
      }
    }
    const values = new Uint32Array(indices);
    clusterPreviewIndexCache.set(cacheKey, values);
    return values;
  };

  const uploadPreviewLinkIndices = (values) => {
    const resized = resizeStorageBuffer(linkIndexBuffer, linkIndexCapacity, values);
    linkIndexBuffer = resized.buffer;
    linkIndexCapacity = resized.capacity;
    if (values.byteLength) device.queue.writeBuffer(linkIndexBuffer, 0, values);
    previewLinkCount = values.length;
    // Recreating a bind group per pointer frame costs more than the tiny
    // index upload. It is needed only if the backing buffer grew.
    if (resized.resized) bindGroup = createBindGroup();
  };

  const updateClusterOffsets = (nextPreview) => {
    const size = Math.max(1, geometry?.clusterSlots?.size + 1 || 1);
    if (size > clusterOffsetCapacity) {
      clusterOffsetBuffer.destroy();
      clusterOffsetBuffer = device.createBuffer({
        size: size * 8,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      clusterOffsetCapacity = size;
      clusterBaseOffsets = new Float32Array(clusterOffsetCapacity * 2);
      bindGroup = createBindGroup();
    }
    const offsets = new Float32Array(clusterOffsetCapacity * 2);
    offsets.set(clusterBaseOffsets);
    if (nextPreview?.type === "cluster-drag") {
      for (const [uid, offset] of nextPreview.clusterOffsets) {
        const slot = geometry?.clusterSlots?.get(uid);
        if (slot !== undefined) offsets[slot * 2 + 1] += offset;
      }
    }
    device.queue.writeBuffer(clusterOffsetBuffer, 0, offsets);
  };

  const bufferForName = (name) => ({
    links: linkBuffer,
    linkEdges: linkEdgeBuffer,
    tracks: trackBuffer,
    genes: geneBuffer,
    geneEdges: geneEdgeBuffer,
  })[name];
  const write = (name, range, values) => {
    const buffer = bufferForName(name);
    if (!buffer || !range || range.length !== values.length) return;
    device.queue.writeBuffer(buffer, range.offset * 4, values.buffer, values.byteOffset, values.byteLength);
  };
  const writeAll = (data) => {
    for (const name of Object.keys(data)) {
      const buffer = bufferForName(name);
      if (buffer && data[name].byteLength) device.queue.writeBuffer(buffer, 0, data[name]);
    }
  };
  const uploadGeometry = (nextGeometry) => {
    const { data } = nextGeometry;
    linkBuffer = bufferFor(device, linkBuffer, data.links);
    linkEdgeBuffer = bufferFor(device, linkEdgeBuffer, data.linkEdges);
    trackBuffer = bufferFor(device, trackBuffer, data.tracks);
    geneBuffer = bufferFor(device, geneBuffer, data.genes);
    geneEdgeBuffer = bufferFor(device, geneEdgeBuffer, data.geneEdges);
    linkCount = data.links.length / 7;
    linkEdgeCount = data.linkEdges.length / 10;
    trackCount = data.tracks.length / 10;
    geneCount = data.genes.length / 7;
    geneEdgeCount = data.geneEdges.length / 10;
  };
  const visibleLinkIndices = () => new Uint32Array(
    [...scene.links.values()]
      .filter((link) => link.visible)
      .map((link) => linkRecordIndexByUid.get(link.source.uid))
      .filter((index) => index !== undefined)
  );
  const resetRetainedClusterGeometry = () => {
    retainedClusterGeometry = false;
    clusterBaseOffsets.fill(0);
    previewLinksActive = false;
  };
  const restorePreview = (records) => {
    if (!records || !geometry) return;
    if (records.full) {
      writeAll(geometry.data);
      return;
    }
    for (const uid of records.links) {
      const ranges = geometry.ranges.links.get(uid);
      if (!ranges) continue;
      write("links", ranges.links, geometry.data.links.subarray(ranges.links.offset, ranges.links.offset + ranges.links.length));
      write("linkEdges", ranges.linkEdges, geometry.data.linkEdges.subarray(ranges.linkEdges.offset, ranges.linkEdges.offset + ranges.linkEdges.length));
    }
    for (const uid of records.genes) {
      const ranges = geometry.ranges.genes.get(uid);
      if (!ranges) continue;
      write("genes", ranges.genes, geometry.data.genes.subarray(ranges.genes.offset, ranges.genes.offset + ranges.genes.length));
      write("geneEdges", ranges.geneEdges, geometry.data.geneEdges.subarray(ranges.geneEdges.offset, ranges.geneEdges.offset + ranges.geneEdges.length));
    }
    for (const uid of records.loci) {
      const ranges = geometry.ranges.loci.get(uid);
      if (ranges) write("tracks", ranges.tracks, geometry.data.tracks.subarray(ranges.tracks.offset, ranges.tracks.offset + ranges.tracks.length));
    }
  };
  const applyPreview = (nextPreview, scales, config, viewport) => {
    // A committed cluster reorder retains the old GPU geometry plus row
    // offsets. Materialize it only when another kind of edit needs direct
    // per-record geometry in the new scene coordinates.
    if (retainedClusterGeometry && nextPreview?.type !== "cluster-drag") {
      geometry = buildGeometry(scene, scales, config);
      uploadGeometry(geometry);
      uploadLinkRecords(buildLinkRecords(scene, scales, config, geometry.clusterSlots));
      resetRetainedClusterGeometry();
      updateClusterOffsets(null);
    }
    // Cluster-drag links are drawn from a temporary, viewport-limited buffer,
    // so the retained base link buffer never needs restoring or rewriting.
    if (!patchedRecords?.clusterOffsets) restorePreview(patchedRecords);
    updateClusterOffsets(nextPreview);
    patchedRecords = recordsForPreview(scene, nextPreview);
    if (!patchedRecords || !geometry) {
      previewLinksActive = false;
      return;
    }
    if (patchedRecords.clusterOffsets) {
      uploadPreviewLinkIndices(clusterPreviewLinkIndices(nextPreview, viewport, config));
      previewLinksActive = true;
      return;
    }
    previewLinksActive = false;
    if (patchedRecords.full) {
      writeAll(buildGeometry(scene, scales, config, nextPreview, geometry.clusterSlots).data);
      return;
    }
    for (const uid of patchedRecords.links) {
      const ranges = geometry.ranges.links.get(uid);
      const link = scene.links.get(uid);
      if (!ranges || !link) continue;
      const vertices = linkVertices(scene, link, scales, config, nextPreview);
      write("links", ranges.links, vertices.links);
      write("linkEdges", ranges.linkEdges, vertices.linkEdges);
    }
    for (const uid of patchedRecords.genes) {
      const ranges = geometry.ranges.genes.get(uid);
      const gene = scene.genes.get(uid);
      if (!ranges || !gene) continue;
      const vertices = geneVertices(
        gene,
        scales,
        nextPreview,
        geometry.clusterSlots.get(gene.locus.cluster.uid),
        config.gene.shape.strokeWidth
      );
      write("genes", ranges.genes, vertices.genes);
      write("geneEdges", ranges.geneEdges, vertices.geneEdges);
    }
    for (const uid of patchedRecords.loci) {
      const ranges = geometry.ranges.loci.get(uid);
      const locus = scene.loci.get(uid);
      if (ranges && locus) {
        write(
          "tracks",
          ranges.tracks,
          trackVertices(locus, config, nextPreview, geometry.clusterSlots.get(locus.cluster.uid))
        );
      }
    }
  };

  return {
    render({ nextScene, preview: nextPreview = null, camera, scales, config, width, height, pixelRatio }) {
      const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
      const pixelHeight = Math.max(1, Math.round(height * pixelRatio));
      const resized = canvas.width !== pixelWidth || canvas.height !== pixelHeight;
      if (resized) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      if (resized || !configured) {
        context.configure({ device, format, alphaMode: "premultiplied" });
        configured = true;
      }
      if (scene !== nextScene) {
        geometry = buildGeometry(nextScene, scales, config);
        uploadGeometry(geometry);
        uploadLinkRecords(buildLinkRecords(nextScene, scales, config, geometry.clusterSlots));
        resetRetainedClusterGeometry();
        updateClusterOffsets(null);
        scene = nextScene;
        preview = null;
        patchedRecords = null;
        previewLinksActive = false;
      }
      if (preview !== nextPreview) {
        applyPreview(nextPreview, scales, config, viewportForCamera(camera, width, height));
        preview = nextPreview;
      }
      device.queue.writeBuffer(
        uniform,
        0,
        new Float32Array([
          camera.x,
          camera.y,
          camera.k,
          0,
          width,
          height,
          0,
          0,
          config.link.asLine ? 1 : 0,
          config.link.straight ? 1 : 0,
          config.link.strokeWidth,
          0,
        ])
      );
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 1, g: 1, b: 1, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      if (previewLinksActive) {
        pass.setPipeline(linkPipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(60, previewLinkCount);
      } else if (linkBuffer) {
        pass.setVertexBuffer(0, linkBuffer);
        pass.draw(linkCount);
      }
      if (previewLinksActive) {
        pass.setPipeline(linkLinePipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(132, previewLinkCount);
      } else if (linkEdgeBuffer) {
        pass.setPipeline(strokePipeline);
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, linkEdgeBuffer);
        pass.draw(6, linkEdgeCount);
      }
      pass.setPipeline(strokePipeline);
      pass.setBindGroup(0, bindGroup);
      if (trackBuffer) {
        pass.setVertexBuffer(0, trackBuffer);
        pass.draw(6, trackCount);
      }
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      if (geneBuffer) {
        pass.setVertexBuffer(0, geneBuffer);
        pass.draw(geneCount);
      }
      pass.setPipeline(strokePipeline);
      pass.setBindGroup(0, bindGroup);
      if (geneEdgeBuffer) {
        pass.setVertexBuffer(0, geneEdgeBuffer);
        pass.draw(6, geneEdgeCount);
      }
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
    adoptClusterOrder(nextScene, sourceScene, committedPreview) {
      if (
        !geometry ||
        !committedPreview ||
        committedPreview.type !== "cluster-drag" ||
        scene !== sourceScene
      ) {
        return false;
      }
      // Geometry is still expressed in the old scene's row coordinates. Keep
      // that buffer and make the committed preview offsets its new baseline;
      // nextScene remains authoritative for hit testing, labels, and export.
      for (const [uid, offset] of committedPreview.clusterOffsets) {
        const slot = geometry.clusterSlots.get(uid);
        if (slot !== undefined) clusterBaseOffsets[slot * 2 + 1] += offset;
      }
      scene = nextScene;
      preview = null;
      patchedRecords = null;
      retainedClusterGeometry = true;
      clusterPreviewIndexCache = new Map();
      updateClusterOffsets(null);
      uploadPreviewLinkIndices(visibleLinkIndices());
      previewLinksActive = true;
      return true;
    },
    adoptGeneAnchor(nextScene, sourceScene, { offsets, flippedLoci }) {
      if (!geometry || scene !== sourceScene) return false;

      // First establish the new cluster-coordinate baseline. Target scene
      // geometry is absolute, so sparse replacements below remove this base
      // again before the vertex shader reapplies it.
      for (const [uid, offset] of offsets || []) {
        const slot = geometry.clusterSlots.get(uid);
        if (slot !== undefined) clusterBaseOffsets[slot * 2] += offset;
      }
      const baseXForCluster = (uid) => {
        const slot = geometry.clusterSlots.get(uid);
        return slot === undefined ? 0 : clusterBaseOffsets[slot * 2];
      };

      const affectedGenes = new Set();
      for (const locusUid of flippedLoci || []) {
        const locus = nextScene.loci.get(locusUid);
        if (!locus) continue;
        const clusterSlot = geometry.clusterSlots.get(locus.cluster.uid);
        const offsetX = baseXForCluster(locus.cluster.uid);
        for (const gene of locus.genes) {
          const targetGene = nextScene.genes.get(gene.source.uid);
          const ranges = geometry.ranges.genes.get(gene.source.uid);
          if (!targetGene || !ranges || clusterSlot === undefined) continue;
          const vertices = geneVertices(
            targetGene,
            scales,
            null,
            clusterSlot,
            config.gene.shape.strokeWidth
          );
          write("genes", ranges.genes, translateVertexX(vertices.genes, offsetX));
          write("geneEdges", ranges.geneEdges, translateVertexX(vertices.geneEdges, offsetX));
          affectedGenes.add(gene.source.uid);
        }
        const ranges = geometry.ranges.loci.get(locusUid);
        if (ranges && clusterSlot !== undefined) {
          write(
            "tracks",
            ranges.tracks,
            translateVertexX(trackVertices(locus, config, null, clusterSlot), offsetX)
          );
        }
      }

      // Ribbons are already instanced for retained cluster movement. Patch
      // only endpoints whose loci flipped, rather than rebuilding records for
      // every link in a large chart.
      for (const link of nextScene.links.values()) {
        if (
          !affectedGenes.has(link.source.query.uid) &&
          !affectedGenes.has(link.source.target.uid)
        ) continue;
        const index = linkRecordIndexByUid.get(link.source.uid);
        if (index === undefined) continue;
        const record = linkRecordForGpu(
          nextScene,
          link,
          scales,
          config,
          geometry.clusterSlots,
          baseXForCluster
        );
        if (record) device.queue.writeBuffer(linkRecordBuffer, index * 16 * 4, record);
      }

      scene = nextScene;
      preview = null;
      patchedRecords = null;
      retainedClusterGeometry = true;
      clusterPreviewIndexCache = new Map();
      updateClusterOffsets(null);
      uploadPreviewLinkIndices(visibleLinkIndices());
      previewLinksActive = true;
      return true;
    },
    destroy() {
      linkBuffer?.destroy();
      linkEdgeBuffer?.destroy();
      linkRecordBuffer.destroy();
      linkIndexBuffer.destroy();
      trackBuffer?.destroy();
      geneBuffer?.destroy();
      geneEdgeBuffer?.destroy();
      clusterOffsetBuffer.destroy();
      uniform.destroy();
      device.destroy();
    },
  };
}
