// Deliberately small, direct WebGPU renderer for the renderer-neutral scene.
// It owns dense geometric marks and annotation rectangles. Canvas still draws
// text and other decorations; SVG provides static export.

import { color } from "d3-color";
import { worldViewport } from "./camera.mjs";
import { figureConfig } from "./theme.mjs";
import { sampleLinkGeometry } from "./links/layout.mjs";
import { linkColours } from "./links/style.mjs";
import {
  clusterPreviewInViewport,
  genePolygonForPreview,
  linkVisibleForPreview,
  previewLinkAnchors,
  recordsForPreview,
  clusterOffsetForPreview,
  geneVisibleForPreview,
  locusGeometryForPreview,
  locusOffsetForPreview,
  previewOffsetsForLocus,
} from "./scenePreview.mjs";
import { annotationOffsetForPreview, annotationPanelsForFrame, annotationPanelsInViewport } from "./annotations.mjs";

const shader = /* wgsl */ `
struct Camera {
  // camera x/y, zoom, shared annotation x offset.
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
struct LocusTransforms {
  // x translation, reserved, x scale, flip axis (in retained coordinates).
  values: array<vec4f>,
}
@group(0) @binding(4) var<storage, read> locusTransforms: LocusTransforms;

fn transformPoint(point: vec2f, slot: u32) -> vec2f {
  let transform = locusTransforms.values[slot];
  return vec2f(
    transform.w + (point.x - transform.w) * transform.z + transform.x,
    point.y,
  ) + clusterOffsets.values[slot];
}

fn transformEndpoint(endpoint: vec4f) -> vec4f {
  let slot = u32(endpoint.w);
  let first = transformPoint(vec2f(endpoint.x, endpoint.z), slot);
  let second = transformPoint(vec2f(endpoint.y, endpoint.z), slot);
  return vec4f(first.x, second.x, first.y, endpoint.w);
}

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) colour: vec4f,
  @location(2) transformSlot: f32,
}
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) colour: vec4f,
}

struct RectangleInput {
  @location(0) rect: vec4f,
  @location(1) colour: vec4f,
  @location(2) rowSlot: f32,
}

@vertex fn rectangleVertex(input: RectangleInput, @builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var corners = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
  );
  // Annotation columns stay aligned when a cluster moves horizontally; only
  // its row translation is inherited. Locus flips never reflect heatmaps.
  let offset = vec2f(camera.transform.w, clusterOffsets.values[u32(input.rowSlot)].y);
  let world = input.rect.xy + corners[vertexIndex] * input.rect.zw + offset;
  let screen = world * camera.transform.z + camera.transform.xy;
  var output: VertexOutput;
  output.position = vec4f(screen.x / camera.viewport.x * 2.0 - 1.0,
    1.0 - screen.y / camera.viewport.y * 2.0, 0.0, 1.0);
  output.colour = input.colour;
  return output;
}

struct StrokeInput {
  @location(0) first: vec2f,
  @location(1) second: vec2f,
  @location(2) colour: vec4f,
  @location(3) transformSlot: f32,
  @location(4) width: f32,
}

@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  let screen = transformPoint(input.position, u32(input.transformSlot))
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
  return projectStroke(
    transformPoint(input.first, u32(input.transformSlot)),
    transformPoint(input.second, u32(input.transformSlot)),
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
  let query = transformEndpoint(link.query);
  let mate = transformEndpoint(link.mate);
  let queryIsTop = query.z <= mate.z;
  let top = select(mate, query, queryIsTop);
  let bottom = select(query, mate, queryIsTop);
  let topY = top.z;
  let bottomY = bottom.z;
  let topX = select(top.x, top.y, edge == 0u);
  let bottomX = select(bottom.x, bottom.y, edge == 0u);
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
  let query = transformEndpoint(link.query);
  let mate = transformEndpoint(link.mate);
  let queryX = (query.x + query.y) / 2.0;
  let mateX = (mate.x + mate.y) / 2.0;
  let queryY = query.z;
  let mateY = mate.z;
  if (camera.linkStyle.y > 0.5) {
    return vec2f(mix(queryX, mateX, amount), mix(queryY, mateY, amount));
  }
  let middle = (queryY + mateY) / 2.0;
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
  const colour = color(value)?.rgb();
  return colour
    ? [Number.isFinite(colour.r) ? colour.r / 255 : 0,
      Number.isFinite(colour.g) ? colour.g / 255 : 0,
      Number.isFinite(colour.b) ? colour.b / 255 : 0, colour.opacity ?? 1]
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

// A committed trim can make a gene or link invisible in the retained scene.
// Keep its GPU range while the containing locus remains trimmed: a later
// handle drag may expand the boundary and must be able to reveal it without a
// complete scene rebuild.
function locusCanChangeTrimVisibility(locus) {
  return (
    locus?.state?.start > locus?.source?.start ||
    locus?.state?.end < locus?.source?.end
  );
}

function linkCanChangeTrimVisibility(scene, link) {
  return [link.source.query.uid, link.source.target.uid].some((uid) =>
    locusCanChangeTrimVisibility(scene.genes.get(uid)?.locus)
  );
}

function transparent(colour) {
  return [colour[0], colour[1], colour[2], 0];
}

function geneVertices(gene, scales, preview = null, clusterSlot = 0, strokeWidth = 1, strokeColour = "black") {
  const fill = [];
  const edge = [];
  const visible = geneVisibleForPreview(preview, gene);
  const colour = rgba(gene.source.colour || scales.colour(scales.group(gene.source.uid)));
  pushGene(
    fill,
    edge,
    gene,
    visible ? colour : transparent(colour),
    genePolygonForPreview(preview, gene, { includeClusterOffset: false }),
    visible ? rgba(strokeColour) : [0, 0, 0, 0],
    clusterSlot,
    strokeWidth
  );
  return { genes: new Float32Array(fill), geneEdges: new Float32Array(edge) };
}

function linkVertices(scene, link, scales, config, preview = null) {
  const fill = [];
  const edge = [];
  const visible = linkVisibleForPreview(scene, link, preview, config);
  const colours = linkColours(link.source, scales, config);
  const colour = rgba(colours.fill), stroke = rgba(colours.stroke);
  const opacity = link.opacity ?? 1;
  colour[3] *= opacity;
  stroke[3] *= opacity;
  pushLink(fill, edge, link, visible ? colour : transparent(colour), visible ? stroke : transparent(stroke), {
    // Keeping retained link records at a constant vertex count lets a trim
    // preview toggle visibility by alpha alone.
    visible: true,
    anchors: preview ? previewLinkAnchors(scene, link, preview) : link.anchors,
    asLine: config.link.asLine,
    straight: config.link.straight,
    strokeWidth: config.link.strokeWidth,
  });
  return { links: new Float32Array(fill), linkEdges: new Float32Array(edge) };
}

function linkEndpointForGpu(gene, clusterSlot, offsetX = 0, offsetY = 0) {
  const forward = gene.display.strand === 1;
  return [
    (forward ? gene.bounds.minX : gene.bounds.maxX) - offsetX,
    (forward ? gene.bounds.maxX : gene.bounds.minX) - offsetX,
    gene.locus.y + gene.locus.track.y - offsetY,
    clusterSlot,
  ];
}

function linkRecordForGpu(scene, link, scales, config, locusSlots, clusterOffsetX = () => 0, clusterOffsetY = () => 0) {
  const query = scene.genes.get(link.source.query.uid);
  const target = scene.genes.get(link.source.target.uid);
  if (!query || !target) return null;
  const colours = linkColours(link.source, scales, config);
  const fill = rgba(colours.fill), stroke = rgba(colours.stroke);
  fill[3] *= link.opacity ?? 1;
  stroke[3] *= link.opacity ?? 1;
  return new Float32Array([
    ...linkEndpointForGpu(
      query,
      locusSlots.get(query.locus.source.uid),
      clusterOffsetX(query.locus.cluster.uid),
      clusterOffsetY(query.locus.cluster.uid)
    ),
    ...linkEndpointForGpu(
      target,
      locusSlots.get(target.locus.source.uid),
      clusterOffsetX(target.locus.cluster.uid),
      clusterOffsetY(target.locus.cluster.uid)
    ),
    ...fill,
    ...stroke,
  ]);
}

function buildLinkRecords(scene, scales, config, locusSlots) {
  const values = [];
  const indexByUid = new Map();
  for (const link of scene.links.values()) {
    const record = linkRecordForGpu(scene, link, scales, config, locusSlots);
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

function translateVertices(values, offsetX, offsetY, stride) {
  if (!offsetX && !offsetY) return values;
  const translated = new Float32Array(values);
  for (let index = 0; index < translated.length; index += stride) {
    translated[index] -= offsetX;
    translated[index + 1] -= offsetY;
    if (stride === 10) {
      translated[index + 2] -= offsetX;
      translated[index + 3] -= offsetY;
    }
  }
  return translated;
}

function buildGeometry(scene, scales, config) {
  const links = [];
  const genes = [];
  const linkEdges = [];
  const geneEdges = [];
  const tracks = [];
  const ranges = { links: new Map(), genes: new Map(), loci: new Map() };
  const slots = new Map(
    [...scene.clusters.keys()].map((uid, index) => [uid, index + 1])
  );
  // Each locus gets one slot shared by its genes, track, and link endpoints.
  // Cluster slots retain committed translations; locus slots inherit them.
  const locusSlots = new Map();
  let nextSlot = slots.size + 1;
  for (const uid of scene.loci.keys()) {
    locusSlots.set(uid, nextSlot++);
  }
  for (const link of scene.links.values()) {
    // Normally an invisible link has no reason to consume a GPU range. The
    // exception is a link hidden solely by a committed trim: it can reappear
    // during an expanding trim preview.
    if (!link.visible && !linkCanChangeTrimVisibility(scene, link)) continue;
    const vertices = linkVertices(scene, link, scales, config);
    ranges.links.set(link.source.uid, {
      links: append(links, vertices.links),
      linkEdges: append(linkEdges, vertices.linkEdges),
    });
  }
  for (const gene of scene.genes.values()) {
    // Retain hidden genes belonging to committed trims so a later drag can
    // reveal them by changing alpha in-place. Other hidden records stay out
    // of the dense buffer as before.
    if (!gene.visible && !locusCanChangeTrimVisibility(gene.locus)) continue;
    const vertices = geneVertices(
      gene,
      scales,
      null,
      locusSlots.get(gene.locus.source.uid),
      config.gene.shape.strokeWidth, config.gene.shape.stroke
    );
    ranges.genes.set(gene.source.uid, {
      genes: append(genes, vertices.genes),
      geneEdges: append(geneEdges, vertices.geneEdges),
    });
  }
  for (const locus of scene.loci.values()) {
    ranges.loci.set(locus.source.uid, {
      tracks: append(tracks, trackVertices(locus, config, null, locusSlots.get(locus.source.uid))),
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
    locusSlots,
    slotCount: nextSlot,
  };
}

function isLocusTransformPreview(preview) {
  return ["locus-offset", "locus-offsets", "locus-flip"].includes(preview?.type);
}

function viewportForCamera(camera, width, height, overscan = 20) {
  return worldViewport(camera, { width, height }, overscan);
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
      { binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
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
  // Canvas/SVG smooth shape edges by default. Use multisampling for comparable
  // WebGPU edge quality without reducing the requested backing resolution.
  const multisample = { count: 4 };
  const pipeline = await createPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "vertexMain", buffers: vertexBuffers },
    fragment: { module, entryPoint: "fragmentMain", targets: target },
    primitive: { topology: "triangle-list" },
    multisample,
  });
  const strokePipeline = await createPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "strokeVertex", buffers: strokeVertexBuffers },
    fragment: { module, entryPoint: "fragmentMain", targets: target },
    primitive: { topology: "triangle-list" },
    multisample,
  });
  const linkPipeline = await createPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "linkFillVertex" },
    fragment: { module, entryPoint: "fragmentMain", targets: target },
    primitive: { topology: "triangle-list" },
    multisample,
  });
  const linkLinePipeline = await createPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: "linkEdgeVertex" },
    fragment: { module, entryPoint: "fragmentMain", targets: target },
    primitive: { topology: "triangle-list" },
    multisample,
  });
  // Annotation-only pipeline: ordinary synteny charts never compile it.
  let rectanglePipeline = null;
  const rectanglePipelineDescriptor = {
    layout: pipelineLayout,
    vertex: { module, entryPoint: "rectangleVertex", buffers: [{
      arrayStride: 36,
      stepMode: "instance",
      attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x4" },
        { shaderLocation: 1, offset: 16, format: "float32x4" },
        { shaderLocation: 2, offset: 32, format: "float32" },
      ],
    }] },
    fragment: { module, entryPoint: "fragmentMain", targets: target },
    primitive: { topology: "triangle-list" },
    multisample,
  };
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
    // A runtime-sized WGSL array must fit at least one LinkRecord, even when
    // the chart has no links. Validation also applies to zero-instance draws.
    size: 64,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  let linkRecordCapacity = 16;
  let linkIndexBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  let linkIndexCapacity = 1;
  let locusTransformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  let locusTransformCapacity = 1;
  const createBindGroup = () => device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniform } },
      { binding: 1, resource: { buffer: clusterOffsetBuffer } },
      { binding: 2, resource: { buffer: linkRecordBuffer } },
      { binding: 3, resource: { buffer: linkIndexBuffer } },
      { binding: 4, resource: { buffer: locusTransformBuffer } },
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
  let multisampleTexture = null;
  let annotationBuffer = null, annotationKeyBuffer = null;
  let annotationCount = 0, annotationKeyCount = 0;
  let annotationPanels = null, annotationKeyPreview = null, annotationGroupRows = null;
  const annotationRows = new Map(), annotationKeys = new Map();

  const appendRectangle = (values, rect, x, y, slot = 0) => {
    values.push(x + rect.x, y + rect.y, rect.width, rect.height, ...rgba(rect.fill), slot);
  };
  const updateAnnotations = (nextPreview) => {
    if (!scene.annotationPanels?.length) {
      annotationBuffer?.destroy(); annotationKeyBuffer?.destroy();
      annotationBuffer = annotationKeyBuffer = null;
      annotationCount = annotationKeyCount = 0;
      annotationPanels = scene.annotationPanels; annotationKeyPreview = annotationGroupRows = null;
      annotationRows.clear(); annotationKeys.clear();
      return;
    }
    const changed = annotationPanels !== scene.annotationPanels;
    const cellsChanged = changed && (!annotationPanels || annotationPanels.length !== scene.annotationPanels.length ||
      scene.annotationPanels.some((panel, i) => {
        const before = annotationPanels[i];
        return panel.uid !== before.uid || panel.rows !== before.rows || panel.x !== before.x || panel.rowOffset !== before.rowOffset;
      }));
    if (changed) annotationPanels = scene.annotationPanels;
    if (cellsChanged) {
      annotationRows.clear();
      const values = [];
      for (const panel of annotationPanels || []) {
        const rows = new Map(); annotationRows.set(panel.uid, rows);
        for (const row of panel.rows) {
          const offsets = [];
          const slot = geometry.clusterSlots.get(row.uid);
          // Retained gene geometry may still use an earlier row order. Remove
          // that baseline from new cell instances before the GPU adds it back.
          const y = scene.clusters.get(row.uid).y + panel.rowOffset - clusterBaseOffsets[slot * 2 + 1];
          for (const cell of row.cells) {
            offsets.push(values.length / 9);
            for (const rect of cell.rects) appendRectangle(values, rect, panel.x, y, slot);
          }
          offsets.push(values.length / 9); rows.set(row.uid, offsets);
        }
      }
      annotationCount = values.length / 9;
      if (annotationCount) annotationBuffer = bufferFor(device, annotationBuffer, new Float32Array(values));
    }
    // Keys follow the current bottom row. Only this small buffer changes
    // during a row drag; cells remain retained and use cluster transforms.
    const keyPreview = nextPreview?.type === "cluster-drag" ? nextPreview : null;
    const groupRows = annotationPanels.some((panel) => panel.markerGroups) ? scene.clusters : null;
    if (changed || annotationKeyPreview !== keyPreview || annotationGroupRows !== groupRows) {
      annotationGroupRows = groupRows;
      annotationKeyPreview = keyPreview;
      annotationKeys.clear();
      const values = [];
      for (const panel of annotationPanelsForFrame(scene, keyPreview)) {
        annotationKeys.set(panel.uid, values.length / 9);
        for (const rect of panel.rects) appendRectangle(values, rect, panel.x, 0);
      }
      annotationKeyCount = values.length / 9;
      if (annotationKeyCount) annotationKeyBuffer = bufferFor(device, annotationKeyBuffer, new Float32Array(values));
    }
  };

  const annotationDrawRanges = (nextPreview, viewport) => {
    const bounds = scene.figureBounds;
    if (!nextPreview && bounds && viewport.minX <= bounds.minX && viewport.maxX >= bounds.maxX &&
        viewport.minY <= bounds.minY && viewport.maxY >= bounds.maxY) {
      return { cells: annotationCount ? [[0, annotationCount]] : [], keys: annotationKeyCount ? [[0, annotationKeyCount]] : [] };
    }
    const cells = [], keys = [];
    for (const panel of annotationPanelsInViewport(scene, nextPreview, viewport, { labels: false })) {
      const rows = annotationRows.get(panel.uid);
      for (const row of panel.rows) {
        const offsets = rows.get(row.uid);
        cells.push([offsets[row.firstCell], offsets[row.lastCell]]);
      }
      const base = annotationKeys.get(panel.uid);
      for (const rect of panel.rects) keys.push([base + rect.keyIndex, base + rect.keyIndex + 1]);
    }
    const merge = (ranges) => {
      ranges.sort((a, b) => a[0] - b[0]);
      const result = [];
      for (const range of ranges) {
        const last = result[result.length - 1];
        if (last && last[1] >= range[0]) last[1] = Math.max(last[1], range[1]);
        else if (range[1] > range[0]) result.push(range);
      }
      return result;
    };
    return { cells: merge(cells), keys: merge(keys) };
  };

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
    const { pairs } = clusterPreviewInViewport(scene, nextPreview, viewport);
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
    const size = geometry?.slotCount || 1;
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
    // Locus slots inherit their cluster's retained and transient translation.
    for (const [uid, slot] of geometry?.locusSlots || []) {
      const locus = scene?.loci.get(uid);
      const clusterSlot = geometry.clusterSlots.get(locus?.cluster.uid);
      offsets[slot * 2] = offsets[clusterSlot * 2];
      offsets[slot * 2 + 1] = offsets[clusterSlot * 2 + 1];
    }
    device.queue.writeBuffer(clusterOffsetBuffer, 0, offsets);
  };

  const updateLocusTransforms = (nextPreview) => {
    const size = geometry?.slotCount || 1;
    if (size > locusTransformCapacity) {
      locusTransformBuffer.destroy();
      locusTransformBuffer = device.createBuffer({
        size: size * 16,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      locusTransformCapacity = size;
      bindGroup = createBindGroup();
    }
    const transforms = new Float32Array(locusTransformCapacity * 4);
    for (let slot = 0; slot < locusTransformCapacity; slot++) transforms[slot * 4 + 2] = 1;
    if (isLocusTransformPreview(nextPreview)) {
      const ids = nextPreview.type === "locus-offsets"
        ? nextPreview.locusOffsets.keys() : [nextPreview.locusUid];
      for (const uid of ids) {
        const slot = geometry.locusSlots.get(uid);
        if (slot === undefined) continue;
        const offset = locusOffsetForPreview(nextPreview, uid);
        transforms[slot * 4] = offset;
        const axis = nextPreview.axes?.get(uid);
        if (axis !== undefined) {
          const locus = scene.loci.get(uid);
          const clusterSlot = geometry.clusterSlots.get(locus.cluster.uid);
          transforms[slot * 4 + 2] = 1 - 2 * nextPreview.progress;
          transforms[slot * 4 + 3] = axis - clusterBaseOffsets[clusterSlot * 2];
        }
      }
    }
    device.queue.writeBuffer(locusTransformBuffer, 0, transforms);
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
    annotationPanels = null;
  };
  const restorePreview = (records) => {
    if (!records || !geometry) return;
    for (const kind of ["links", "genes", "loci"]) for (const uid of records[kind]) {
      for (const [name, range] of Object.entries(geometry.ranges[kind].get(uid) || {})) {
        write(name, range, geometry.data[name].subarray(range.offset, range.offset + range.length));
      }
    }
  };
  const applyPreview = (nextPreview, scales, config, viewport) => {
    // Translations and flips compose with retained cluster offsets. Trimming
    // still needs direct geometry in the current scene coordinates.
    if (retainedClusterGeometry && nextPreview?.type === "locus-trim") {
      geometry = buildGeometry(scene, scales, config);
      uploadGeometry(geometry);
      uploadLinkRecords(buildLinkRecords(scene, scales, config, geometry.locusSlots));
      resetRetainedClusterGeometry();
      updateClusterOffsets(null);
    }
    // Cluster-drag links are drawn from a temporary, viewport-limited buffer,
    // so the retained base link buffer never needs restoring or rewriting.
    if (!patchedRecords?.clusterOffsets) restorePreview(patchedRecords);
    updateClusterOffsets(nextPreview);
    updateLocusTransforms(nextPreview);
    if (isLocusTransformPreview(nextPreview)) {
      // Reuse retained polygons and shader-generated ribbons. No per-gene or
      // per-link vertices are generated/uploaded while dragging or flipping.
      if (!previewLinksActive || preview?.type === "cluster-drag" || patchedRecords) {
        uploadPreviewLinkIndices(visibleLinkIndices());
      }
      previewLinksActive = true;
      patchedRecords = null;
      return;
    }
    patchedRecords = recordsForPreview(scene, nextPreview);
    if (!patchedRecords || !geometry) {
      previewLinksActive = retainedClusterGeometry;
      if (previewLinksActive) uploadPreviewLinkIndices(visibleLinkIndices());
      return;
    }
    if (patchedRecords.clusterOffsets) {
      uploadPreviewLinkIndices(clusterPreviewLinkIndices(nextPreview, viewport, config));
      previewLinksActive = true;
      return;
    }
    previewLinksActive = false;
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
        geometry.locusSlots.get(gene.locus.source.uid),
        config.gene.shape.strokeWidth, config.gene.shape.stroke
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
          trackVertices(locus, config, nextPreview, geometry.locusSlots.get(locus.source.uid))
        );
      }
    }
  };

  // Retain translated geometry; only re-upload loci whose local geometry changed.
  const adoptScene = (nextScene, sourceScene, { scales, config }) => {
    if (!geometry || scene !== sourceScene || !nextScene.changes) return false;
    const loci = [], offsets = [], affectedGenes = new Set();
    for (const uid of nextScene.changes.clusters) {
      const before = sourceScene.clusters.get(uid), after = nextScene.clusters.get(uid);
      if (!before || !after || !geometry.clusterSlots.has(uid)) return false;
      const dx = after.x - before.x, dy = after.y - before.y;
      if (dx || dy) offsets.push([uid, dx, dy]);
    }
    for (const uid of nextScene.changes.loci) {
      const before = sourceScene.loci.get(uid), locus = nextScene.loci.get(uid);
      if (!before || !locus) return false;
      if (before.localX === locus.localX && before.state.start === locus.state.start &&
          before.state.end === locus.state.end && before.state.flipped === locus.state.flipped) continue;
      loci.push(uid);
      if (!geometry.locusSlots.has(uid)) return false;
      for (const gene of locus.genes) {
        affectedGenes.add(gene.source.uid);
        // Trims normally retain hidden ranges for subsequent expansion. If
        // geometry was omitted earlier, let the ordinary render rebuild it
        // rather than silently dropping a newly revealed gene.
        if (gene.visible && !geometry.ranges.genes.has(gene.source.uid)) return false;
      }
    }
    const incidentLinks = [];
    for (const uid of affectedGenes.size ? nextScene.changes.links : []) {
      const link = nextScene.links.get(uid);
      if (link && (affectedGenes.has(link.source.query.uid) || affectedGenes.has(link.source.target.uid))) {
        incidentLinks.push(link);
      }
    }
    for (const link of incidentLinks) {
      if (!link.visible) continue;
      if (!linkRecordIndexByUid.has(link.source.uid)) return false;
      const ranges = geometry.ranges.links.get(link.source.uid);
      if (!retainedClusterGeometry && !ranges?.links.length && !ranges?.linkEdges.length) return false;
    }
    for (const [uid, dx, dy] of offsets) {
      const slot = geometry.clusterSlots.get(uid);
      clusterBaseOffsets[slot * 2] += dx;
      clusterBaseOffsets[slot * 2 + 1] += dy;
    }
    const baseFor = (uid, axis) => {
      const slot = geometry.clusterSlots.get(uid);
      return slot === undefined ? 0 : clusterBaseOffsets[slot * 2 + axis];
    };
    const commit = (name, range, values) => {
      if (!range) return;
      geometry.data[name].set(values, range.offset);
      write(name, range, values);
    };
    for (const uid of loci) {
      const locus = nextScene.loci.get(uid);
      if (!locus) continue;
      const slot = geometry.locusSlots.get(uid);
      const x = baseFor(locus.cluster.uid, 0), y = baseFor(locus.cluster.uid, 1);
      for (const gene of locus.genes) {
        const ranges = geometry.ranges.genes.get(gene.source.uid);
        const target = nextScene.genes.get(gene.source.uid);
        if (!ranges || !target) continue;
        const vertices = geneVertices(target, scales, null, slot, config.gene.shape.strokeWidth, config.gene.shape.stroke);
        commit("genes", ranges.genes, translateVertices(vertices.genes, x, y, 7));
        commit("geneEdges", ranges.geneEdges, translateVertices(vertices.geneEdges, x, y, 10));
      }
      const ranges = geometry.ranges.loci.get(uid);
      commit("tracks", ranges?.tracks, translateVertices(trackVertices(locus, config, null, geometry.locusSlots.get(uid)), x, y, 10));
    }
    // Both regular ribbons and the retained cluster-movement path must see the
    // new endpoints. Only links incident to edited loci need replacing.
    for (const link of incidentLinks) {
      const ranges = geometry.ranges.links.get(link.source.uid);
      if (ranges && !retainedClusterGeometry) {
        const vertices = linkVertices(nextScene, link, scales, config);
        commit("links", ranges.links, vertices.links);
        commit("linkEdges", ranges.linkEdges, vertices.linkEdges);
      }
      const index = linkRecordIndexByUid.get(link.source.uid);
      if (index === undefined) continue;
      const record = linkRecordForGpu(nextScene, link, scales, config, geometry.locusSlots,
        (uid) => baseFor(uid, 0), (uid) => baseFor(uid, 1));
      if (record) device.queue.writeBuffer(linkRecordBuffer, index * 16 * 4, record);
    }
    if (offsets.length) retainedClusterGeometry = true;
    scene = nextScene;
    preview = null;
    patchedRecords = null;
    clusterPreviewIndexCache = new Map();
    updateClusterOffsets(null);
    updateLocusTransforms(null);
    previewLinksActive = retainedClusterGeometry;
    if (previewLinksActive) uploadPreviewLinkIndices(visibleLinkIndices());
    return true;
  };

  return {
    render({ nextScene, preview: nextPreview = null, camera, scales, config, width, height, pixelRatio }) {
      config = figureConfig(config);
      const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
      const pixelHeight = Math.max(1, Math.round(height * pixelRatio));
      const resized = canvas.width !== pixelWidth || canvas.height !== pixelHeight;
      if (resized) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      if (resized || !configured) {
        context.configure({ device, format, alphaMode: "premultiplied" });
        multisampleTexture?.destroy();
        multisampleTexture = device.createTexture({
          size: [pixelWidth, pixelHeight],
          format,
          sampleCount: multisample.count,
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        configured = true;
      }
      if (scene !== nextScene && nextScene.genes === scene?.genes && nextScene.links === scene?.links &&
          nextScene.loci === scene?.loci && nextScene.clusters === scene?.clusters) {
        // Annotation-only edits retain all biological geometry and GPU buffers.
        scene = nextScene;
      }
      if (scene !== nextScene) {
        geometry = buildGeometry(nextScene, scales, config);
        uploadGeometry(geometry);
        uploadLinkRecords(buildLinkRecords(nextScene, scales, config, geometry.locusSlots));
        resetRetainedClusterGeometry();
        scene = nextScene;
        updateClusterOffsets(null);
        updateLocusTransforms(null);
        preview = null;
        patchedRecords = null;
        previewLinksActive = false;
      }
      if (preview !== nextPreview) {
        applyPreview(nextPreview, scales, config, viewportForCamera(camera, width, height));
        preview = nextPreview;
      }
      updateAnnotations(nextPreview);
      device.queue.writeBuffer(
        uniform,
        0,
        new Float32Array([
          camera.x,
          camera.y,
          camera.k,
          annotationOffsetForPreview(scene, nextPreview),
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
          view: multisampleTexture.createView(),
          resolveTarget: context.getCurrentTexture().createView(),
          clearValue: [0, 0, 0, 0],
          loadOp: "clear",
          storeOp: "discard",
        }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      if (previewLinksActive) {
        if (previewLinkCount) {
          pass.setPipeline(linkPipeline);
          pass.setBindGroup(0, bindGroup);
          pass.draw(60, previewLinkCount);
        }
      } else if (linkBuffer) {
        pass.setVertexBuffer(0, linkBuffer);
        pass.draw(linkCount);
      }
      if (previewLinksActive) {
        if (previewLinkCount) {
          pass.setPipeline(linkLinePipeline);
          pass.setBindGroup(0, bindGroup);
          pass.draw(132, previewLinkCount);
        }
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
      if (annotationCount || annotationKeyCount) {
        const ranges = annotationDrawRanges(nextPreview, viewportForCamera(camera, width, height));
        if (ranges.cells.length || ranges.keys.length) {
          rectanglePipeline ||= device.createRenderPipeline(rectanglePipelineDescriptor);
          pass.setPipeline(rectanglePipeline);
          pass.setBindGroup(0, bindGroup);
          if (ranges.cells.length) {
            pass.setVertexBuffer(0, annotationBuffer);
            for (const [first, end] of ranges.cells) pass.draw(6, end - first, 0, first);
          }
          if (ranges.keys.length) {
            pass.setVertexBuffer(0, annotationKeyBuffer);
            for (const [first, end] of ranges.keys) pass.draw(6, end - first, 0, first);
          }
        }
      }
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
    adoptScene,
    destroy() {
      multisampleTexture?.destroy();
      linkBuffer?.destroy();
      linkEdgeBuffer?.destroy();
      linkRecordBuffer.destroy();
      linkIndexBuffer.destroy();
      trackBuffer?.destroy();
      geneBuffer?.destroy();
      geneEdgeBuffer?.destroy();
      annotationBuffer?.destroy();
      annotationKeyBuffer?.destroy();
      clusterOffsetBuffer.destroy();
      locusTransformBuffer.destroy();
      uniform.destroy();
      device.destroy();
    },
  };
}
