import { layoutClusterLabels } from "./clusterLabels.mjs";
import { boundsInViewport } from "./camera.mjs";
import { clusterPairKey, endpointGeneId, endpointLocus, projectSceneEndpoint, orderLinkAnchors, interpolateLinkAnchors, interpolateLinkOpacity } from "../links/layout.mjs";
import { arrangeTrimIndicators, createTrimIndicators } from "../loci/trimIndicators.mjs";
import { overlayLinkRecords } from "./linkRecords.mjs";
import { sameCoordinate } from "../utils/values.mjs";

function clusterUidForLocus(locus) {
  return locus.cluster?.uid ?? locus.cluster?.source?.uid ?? locus.source.clusterUid;
}

function chromeForPreview(scene, maxX) {
  if (!scene.chrome) return null;
  const dx = scene.annotationPanels?.length ? annotationOffsetForPreview(scene, { contentMaxX: maxX }) : maxX - scene.bounds.maxX;
  return {
    ...scene.chrome,
    legend: {
      ...scene.chrome.legend,
      position: {
        ...scene.chrome.legend.position,
        x:
          scene.chrome.legend.placement === "bottom"
            ? scene.chrome.legend.position.x
            : scene.chrome.legend.position.x + dx,
      },
    },
  };
}

/** Keep the annotation group beyond stationary scales while loci move. */
export function annotationOffsetForPreview(scene, preview) {
  if (!scene.annotationPanels?.length || preview?.contentMaxX === undefined) return 0;
  let right = -Infinity;
  for (const locus of scene.loci.values()) right = Math.max(right, locus.worldEnd);
  const movingRight = scene.bounds.maxX + preview.contentMaxX - right;
  return Math.max(movingRight, scene.annotationChromeRight ?? -Infinity) -
    (scene.annotationAnchorX ?? scene.bounds.maxX);
}

function locusPreview(scene, fields, { startFor, endFor, alignLabels = false,
  affectedClusters = scene.clusters.values(), labelWidthFor = null }) {
  let contentMaxX = -Infinity;
  for (const locus of scene.loci.values()) contentMaxX = Math.max(contentMaxX, endFor(locus));
  const alignment = scene.clusters.values().next().value?.info.anchor === "start" ? "left" : "right";
  const labels = layoutClusterLabels(alignLabels ? scene.clusters.values() : affectedClusters, {
    alignLabels, labelAlignment: alignment, startFor,
    textFor: (cluster) => fields.clusterLabelTexts?.get(cluster.source.uid) ?? cluster.info.locusText,
    widthFor: (cluster, text) => labelWidthFor && fields.clusterLabelTexts?.has(cluster.source.uid)
      ? labelWidthFor(cluster.source, text) : cluster.info.width,
  });
  const clusterLabelOffsets = new Map([...labels].map(([uid, info]) =>
    [uid, info.x - scene.clusters.get(uid).info.x]));
  return {
    ...fields,
    contentMaxX,
    clusterLabelOffsets,
    chrome: chromeForPreview(scene, contentMaxX),
  };
}

/** Describe several transient locus translations without rebuilding the scene. */
export function createLocusOffsetsPreview(scene, offsets, { alignLabels }) {
  const locusOffsets = new Map();
  const affectedClusters = new Set();
  for (const [locusUid, offset] of offsets) {
    const locus = scene.loci.get(locusUid);
    if (!locus) continue;
    locusOffsets.set(locusUid, offset - locus.localX);
    const cluster = scene.clusters.get(locus.cluster.uid);
    if (cluster) affectedClusters.add(cluster);
  }
  if (!locusOffsets.size) return null;
  const offsetFor = (candidate) => locusOffsets.get(candidate.source.uid) || 0;
  const startFor = (candidate) => candidate.worldStart + offsetFor(candidate);
  const endFor = (candidate) => candidate.worldEnd + offsetFor(candidate);
  return locusPreview(scene, {
    type: "locus-offsets",
    locusOffsets,
  }, { startFor, endFor, alignLabels, affectedClusters });
}

/**
 * Describe a transient trim using the current scene and updated locus-scale
 * offsets. The controller updates scales (but not the scene) before calling
 * this, so sibling loci retain their correct packed positions without a full
 * data-to-scene projection for every pointer event.
 */
export function createLocusTrimPreview(
  scene,
  locusUid,
  state,
  { localXFor, scaleX, alignLabels, shape, trimIndicatorStyle = {}, clusterLabelText = null, labelWidthFor = null }
) {
  const locus = scene.loci.get(locusUid);
  if (!locus) return null;

  const locusOffsets = new Map();
  for (const candidate of scene.loci.values()) {
    locusOffsets.set(candidate.source.uid, localXFor(candidate.source.uid) - candidate.localX);
  }
  const offsetFor = (candidate) => locusOffsets.get(candidate.source.uid) || 0;
  const trimmed = {
    worldStart: locus.x + offsetFor(locus) + scaleX(state.start),
    worldEnd: locus.x + offsetFor(locus) + scaleX(state.end),
    track: {
      ...locus.track,
      x1: scaleX(state.start),
      x2: scaleX(state.end),
    },
    hover: {
      ...locus.hover,
      x: scaleX(state.start),
      width: scaleX(state.end) - scaleX(state.start),
      leftHandleX: scaleX(state.start) - 8,
      rightHandleX: scaleX(state.end),
    },
    trimIndicators: createTrimIndicators({
      locus: locus.source,
      state,
      getGeneState: (gene) => scene.genes.get(gene.uid)?.display || gene,
      scaleX,
      shape,
    }),
  };
  const locusGeometry = new Map([[locusUid, trimmed]]);
  const arrangedTrimIndicators = arrangeTrimIndicators(
    scene.loci.values(),
    new Map([[locusUid, trimmed.trimIndicators]]),
    trimIndicatorStyle
  );
  trimmed.trimIndicators = arrangedTrimIndicators.get(locusUid) || [];
  const startFor = (candidate) =>
    candidate.source.uid === locusUid
      ? trimmed.worldStart
      : candidate.worldStart + offsetFor(candidate);
  const endFor = (candidate) =>
    candidate.source.uid === locusUid
      ? trimmed.worldEnd
      : candidate.worldEnd + offsetFor(candidate);
  const geneVisibility = new Map();
  for (const gene of locus.genes) {
    geneVisibility.set(
      gene.source.uid,
      gene.display.start >= state.start && gene.display.end <= state.end + 1
    );
  }

  return locusPreview(scene, {
    type: "locus-trim",
    locusUid,
    locusOffsets,
    loci: locusGeometry,
    geneVisibility,
    ...(clusterLabelText === null
      ? {}
      : {
          clusterLabelTexts: new Map([[
            clusterUidForLocus(locus),
            clusterLabelText,
          ]]),
        }),
  }, { startFor, endFor, alignLabels, labelWidthFor });
}

// Preview patches carry layout deltas rather than cloned scenes. These
// accessors keep SVG, Canvas chrome, and dense WebGPU marks on the same
// locus, cluster, and link geometry.
export function locusOffsetForPreview(preview, locusUid) {
  return preview?.locusOffsets?.get(locusUid) ?? 0;
}

export function clusterLabelOffsetForPreview(preview, clusterUid) {
  return preview?.clusterLabelOffsets?.get(clusterUid) || 0;
}

export function clusterLabelTextForPreview(preview, clusterUid, fallback) {
  return preview?.clusterLabelTexts?.get(clusterUid) ?? fallback;
}

export function clusterOffsetForPreview(preview, clusterUid) {
  return preview?.clusterOffsets?.get(clusterUid) || 0;
}

export function previewOffsetsForLocus(preview, locus) {
  if (!preview || !locus) return { x: 0, y: 0 };
  return {
    x: locusOffsetForPreview(preview, locus.source?.uid),
    y: clusterOffsetForPreview(preview, locus.cluster?.uid ?? locus.source?.clusterUid),
  };
}

export function locusGeometryForPreview(preview, locus) {
  if (preview?.type === "locus-flip") {
    const axis = preview.axes?.get(locus.source.uid);
    if (axis !== undefined) {
      const flip = (x) => x + (axis * 2 - x - x) * preview.progress;
      const start = flip(locus.worldStart);
      const end = flip(locus.worldEnd);
      const hoverStart = flip(locus.x + locus.hover.x);
      const hoverEnd = flip(locus.x + locus.hover.x + locus.hover.width);
      const left = Math.min(start, end);
      const right = Math.max(start, end);
      return {
        offsets: previewOffsetsForLocus(preview, locus),
        worldStart: left,
        worldEnd: right,
        track: {
          ...locus.track,
          x1: flip(locus.x + locus.track.x1) - locus.x,
          x2: flip(locus.x + locus.track.x2) - locus.x,
        },
        hover: {
          ...locus.hover,
          x: Math.min(hoverStart, hoverEnd) - locus.x,
          width: Math.abs(hoverEnd - hoverStart),
          leftHandleX: left - locus.x - 8,
          rightHandleX: right - locus.x,
        },
      };
    }
  }
  const trimmed = preview?.loci?.get(locus.source.uid);
  return {
    offsets: previewOffsetsForLocus(preview, locus),
    ...(trimmed || {}),
  };
}

export function geneVisibleForPreview(preview, gene) {
  return gene && (preview?.geneVisibility?.get(gene.source.uid) ?? gene.visible);
}

/** Describe flip frames without re-projecting the chart. */
function hasDirectionalStrand(gene) {
  return gene?.display.strand === 1 || gene?.display.strand === -1;
}

// Reflected endpoints reverse their order, whereas unstranded endpoints do
// not. Those linked loci need the general source-to-target transition.
export function canPreviewLocusFlip(scene, locusUid) {
  const locus = scene?.loci.get(locusUid);
  if (!locus) return false;
  for (const gene of locus.genes) {
    if (hasDirectionalStrand(gene)) continue;
    for (const source of scene.linksByGene.get(gene.source.uid) || []) {
      if (scene.links.get(source.uid)?.visible) return false;
    }
  }
  return true;
}

export function createLocusFlipPreview(
  scene,
  locusUid,
  { progress = 0, clusterLabelText = null } = {}
) {
  const locus = scene.loci.get(locusUid);
  if (!locus) return null;
  return createLocusFlipsPreview(scene, [locusUid], {
    progress,
    clusterLabelTexts: clusterLabelText === null ? null : new Map([[clusterUidForLocus(locus), clusterLabelText]]),
  });
}

/** Describe simultaneous flips against a shared, unchanged source scene. */
export function createLocusFlipsPreview(scene, locusIds, { progress = 0, clusterLabelTexts = null } = {}) {
  const axes = new Map();
  for (const uid of locusIds) {
    const locus = scene.loci.get(uid);
    if (locus) axes.set(uid, (locus.worldStart + locus.worldEnd) / 2);
  }
  if (!axes.size) return null;
  return {
    type: "locus-flip",
    locusUid: axes.keys().next().value,
    progress,
    ...(clusterLabelTexts === null ? {} : { clusterLabelTexts }),
    // The projected bounds reflect the currently displayed locus, including
    // any committed trim. Source coordinates describe the original record and
    // must not determine the transient flip axis.
    axes,
  };
}

// A flip plus row/locus translations can share the retained source geometry.
export function createLocusFlipTransition(source, target, locusIds, { clusterLabelTexts = null } = {}) {
  const selected = new Set(locusIds || []), changes = target?.changes;
  if (!source || !selected.size || !changes?.clusters || !changes?.loci) return null;
  if (source.clusterOrder?.length !== target.clusterOrder?.length ||
      source.clusterOrder?.some((uid, index) => uid !== target.clusterOrder[index])) return null;
  const clusterDeltas = new Map(), locusDeltas = new Map();
  for (const uid of changes.clusters) {
    const before = source.clusters.get(uid), after = target.clusters.get(uid);
    if (!before || !after || !Number.isFinite(after.x - before.x) || !Number.isFinite(after.y - before.y)) return null;
    if (!sameCoordinate(before.y, after.y)) clusterDeltas.set(uid, after.y - before.y);
  }
  for (const uid of changes.loci) {
    const before = source.loci.get(uid), after = target.loci.get(uid);
    if (!before || !after) return null;
    // A flipped trimmed locus can change its coordinate origin while its
    // visible world-space span remains unchanged.
    const dx = after.worldStart - before.worldStart, dy = clusterDeltas.get(before.cluster.uid) || 0;
    if (!Number.isFinite(dx) || !sameCoordinate(after.y, before.y + dy) ||
        !sameCoordinate(after.worldEnd, before.worldEnd + dx) ||
        (selected.has(uid) ? before.state.flipped === after.state.flipped : before.state.flipped !== after.state.flipped)) return null;
    if (selected.has(uid)) {
      if (before.state.trimLeft?.uid !== after.state.trimRight?.uid ||
          before.state.trimRight?.uid !== after.state.trimLeft?.uid) return null;
    } else if (!sameCoordinate(after.x, before.x + dx) ||
        before.state.start !== after.state.start || before.state.end !== after.state.end) return null;
    if (!sameCoordinate(before.worldStart, after.worldStart)) locusDeltas.set(uid, dx);
  }
  if ([...selected].some((uid) => !changes.loci.has(uid))) return null;
  for (const uid of changes.genes || []) {
    const before = source.genes.get(uid), after = target.genes.get(uid);
    if (!before || !after || before.visible !== after.visible) return null;
    const locus = before.locus, dx = locusDeltas.get(locus.source.uid) || 0;
    const dy = clusterDeltas.get(locus.cluster.uid) || 0;
    const axis = (locus.worldStart + locus.worldEnd) / 2;
    const minX = selected.has(locus.source.uid) ? 2 * axis - before.bounds.maxX + dx : before.bounds.minX + dx;
    const maxX = selected.has(locus.source.uid) ? 2 * axis - before.bounds.minX + dx : before.bounds.maxX + dx;
    if (!sameCoordinate(after.bounds.minX, minX, axis, before.bounds.maxX, dx) ||
        !sameCoordinate(after.bounds.maxX, maxX, axis, before.bounds.minX, dx) ||
        !sameCoordinate(after.bounds.minY, before.bounds.minY + dy) ||
        !sameCoordinate(after.bounds.maxY, before.bounds.maxY + dy)) return null;
  }
  for (const uid of changes.links || []) {
    const before = source.links.get(uid), after = target.links.get(uid);
    if (before?.visible !== after?.visible) return null;
    if (before?.visible) for (const endpoint of [before.source.query, before.source.target]) {
      const gene = source.genes.get(endpointGeneId(endpoint));
      // An unstranded link endpoint keeps its ordering after a flip, unlike a
      // reflected directional endpoint. Use the general transition for it.
      if (selected.has(gene?.locus.source.uid) && !hasDirectionalStrand(gene)) return null;
    }
  }
  const preview = createLocusFlipsPreview(source, selected, { clusterLabelTexts });
  return preview && { ...preview, clusterDeltas, locusDeltas };
}

export function locusFlipTransitionFrame(scene, transition, progress, { alignLabels = false, labelWidthFor = null } = {}) {
  if (!transition.locusDeltas.size && !transition.clusterDeltas.size) return { ...transition, progress };
  const locusOffsets = new Map([...transition.locusDeltas].map(([uid, delta]) => [uid, delta * progress]));
  const clusterOffsets = new Map([...transition.clusterDeltas].map(([uid, delta]) => [uid, delta * progress]));
  const offset = (locus) => locusOffsets.get(locus.source.uid) || 0;
  return locusPreview(scene, { ...transition, progress, locusOffsets, clusterOffsets }, {
    startFor: (locus) => locus.worldStart + offset(locus), endFor: (locus) => locus.worldEnd + offset(locus),
    alignLabels, labelWidthFor,
  });
}

/** Describe temporary cluster rows without rebuilding a scene. */
export function createClusterDragPreview(scene, { clusterUid, position, positions, order, rows }) {
  const clusterOffsets = new Map();
  const clusterOrder = new Map();
  for (const [index, uid] of order.entries()) {
    const cluster = scene.clusters.get(uid);
    if (!cluster) continue;
    const y = positions?.get(uid) ?? (uid === clusterUid ? position : rows[index]);
    clusterOffsets.set(uid, y - cluster.y);
    clusterOrder.set(uid, index);
  }
  return { type: "cluster-drag", clusterUid, clusterOffsets, clusterOrder };
}

function flipAxisForGene(preview, gene) {
  return preview?.type === "locus-flip"
    ? preview.axes?.get(gene?.locus?.source?.uid)
    : undefined;
}

export function geneGeometryForPreview(preview, gene) {
  const axis = flipAxisForGene(preview, gene);
  if (axis === undefined) return {};
  const progress = preview.progress;
  const flipScale = 1 - 2 * progress;
  const flip = (x) => axis + (x - axis) * flipScale;
  return {
    flipAxis: axis,
    flipScale,
    labelX: flip(gene.locus.x + gene.label.x),
  };
}

function linkOffsetsForPreview(scene, link, preview) {
  const query = endpointLocus(link.source.query, scene), target = endpointLocus(link.source.target, scene);
  const uidFor = (endpoint, locus) => locus?.source?.uid ?? scene.genes.get(endpointGeneId(endpoint))?.source?.locusUid;
  const queryOffset = locusOffsetForPreview(preview, uidFor(link.source.query, query));
  const targetOffset = locusOffsetForPreview(preview, uidFor(link.source.target, target));
  // Link anchors are ordered from the upper locus to the lower one, not from
  // source.query to source.target.
  return query?.y <= target?.y
    ? { a: queryOffset, b: targetOffset }
    : { a: targetOffset, b: queryOffset };
}

export function previewLinkAnchors(scene, link, preview) {
  const query = endpointLocus(link.source.query, scene), target = endpointLocus(link.source.target, scene);
  if (!query || !target) return null;
  const anchorForGene = (gene) => {
    const offsets = previewOffsetsForLocus(preview, gene.locus);
    // Bounds are calculated when the retained scene is built and equal the
    // polygon's horizontal extent. Reusing them avoids a vertex scan for each
    // animated link endpoint on every frame.
    let minX = gene.bounds?.minX;
    let maxX = gene.bounds?.maxX;
    // Retain support for compact third-party scenes that only expose a
    // polygon. Production scenes always take the cached-bounds path above.
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
      minX = Infinity;
      maxX = -Infinity;
      for (let index = 0; index < gene.polygon.length; index += 2) {
        minX = Math.min(minX, gene.polygon[index]);
        maxX = Math.max(maxX, gene.polygon[index]);
      }
    }
    const forward = gene.display.strand === 1;
    const axis = flipAxisForGene(preview, gene);
    if (axis === undefined) {
      return [
        (forward ? minX : maxX) + offsets.x,
        (forward ? maxX : minX) + offsets.x,
        gene.locus.y + gene.locus.track.y + offsets.y,
      ];
    }
    const progress = preview.progress;
    const targetMin = axis * 2 - maxX;
    const targetMax = axis * 2 - minX;
    const from = forward ? [minX, maxX] : [maxX, minX];
    const to = forward ? [targetMax, targetMin] : [targetMin, targetMax];
    return [
      from[0] + (to[0] - from[0]) * progress + offsets.x,
      from[1] + (to[1] - from[1]) * progress + offsets.x,
      gene.locus.y + gene.locus.track.y + offsets.y,
    ];
  };
  const anchorFor = (endpoint, locus, reverse = false) => {
    if (endpoint.kind !== "span") {
      const anchors = anchorForGene(scene.genes.get(endpointGeneId(endpoint)));
      return reverse ? [anchors[1], anchors[0], anchors[2]] : anchors;
    }
    const projected = projectSceneEndpoint(endpoint, scene);
    if (!projected) return null;
    let [first, second, y] = projected.anchors;
    if (reverse) [first, second] = [second, first];
    const axis = preview?.type === "locus-flip" ? preview.axes?.get(locus.source.uid) : undefined;
    if (axis !== undefined) {
      first += (2 * axis - 2 * first) * preview.progress;
      second += (2 * axis - 2 * second) * preview.progress;
    }
    const offsets = previewOffsetsForLocus(preview, locus);
    return [first + offsets.x, second + offsets.x, y + offsets.y];
  };
  const first = anchorFor(link.source.query, query), second = anchorFor(link.source.target, target,
    link.source.orientation === -1 && (link.source.query.kind === "span" || link.source.target.kind === "span"));
  return first && second ? orderLinkAnchors(first, second) : null;
}

export function linkGeometryForPreview(scene, link, preview, config) {
  const visible = linkVisibleForPreview(scene, link, preview, config);
  const spans = link.source.query.kind === "span" || link.source.target.kind === "span";
  if (spans && preview) return { visible, anchors: visible ? previewLinkAnchors(scene, link, preview) : link.anchors };
  if (preview?.type === "cluster-drag" || preview?.type === "locus-flip") {
    const query = scene.genes.get(endpointGeneId(link.source.query));
    const target = scene.genes.get(endpointGeneId(link.source.target));
    const affected = preview.type === "cluster-drag" ||
      preview.axes?.has(query?.locus?.source?.uid) ||
      preview.axes?.has(target?.locus?.source?.uid) ||
      preview.locusOffsets?.has(query?.locus?.source?.uid) ||
      preview.locusOffsets?.has(target?.locus?.source?.uid) || Boolean(preview.clusterOffsets?.size);
    return { visible, anchors: visible && affected ? previewLinkAnchors(scene, link, preview) : link.anchors };
  }
  const anchors = link.anchors;
  if (!preview || !anchors) return { visible, anchors };
  const { a, b } = linkOffsetsForPreview(scene, link, preview);
  return { visible, anchors: a || b
    ? [anchors[0] + a, anchors[1] + a, anchors[2], anchors[3] + b, anchors[4] + b, anchors[5]]
    : anchors };
}

export function linkVisibleForPreview(scene, link, preview, config) {
  if (config.link.show === false) return false;
  if (!preview) return link.visible;
  const query = endpointLocus(link.source.query, scene), target = endpointLocus(link.source.target, scene);
  if (!query || !target) return false;
  if (link.source.query.kind !== "span" && link.source.target.kind !== "span") {
    if (!geneVisibleForPreview(preview, scene.genes.get(endpointGeneId(link.source.query))) ||
        !geneVisibleForPreview(preview, scene.genes.get(endpointGeneId(link.source.target)))) return false;
  } else {
    for (const [endpoint, locus] of [[link.source.query, query], [link.source.target, target]]) {
      if (endpoint.kind !== "span") {
        if (!geneVisibleForPreview(preview, scene.genes.get(endpointGeneId(endpoint)))) return false;
        continue;
      }
      if (config.plot?.scaleGenes === false) return false;
      const projected = projectSceneEndpoint(endpoint, scene);
      if (!projected) return false;
      const trim = preview.loci?.get(locus.source.uid);
      if (trim) {
        const offset = locusOffsetForPreview(preview, locus.source.uid);
        const [a, b] = projected.anchors;
        if (Math.min(a, b) + offset < trim.worldStart || Math.max(a, b) + offset > trim.worldEnd) return false;
      } else if (!projected.visible) return false;
    }
  }
  if (preview?.type === "locus-trim") {
    return link.allowed && !link.source.hidden && link.source.identity >= config.link.threshold;
  }
  if (preview?.type !== "cluster-drag") return link.visible;
  const queryOrder = preview.clusterOrder.get(query.cluster.uid);
  const targetOrder = preview.clusterOrder.get(target.cluster.uid);
  return (
    queryOrder !== undefined &&
    targetOrder !== undefined &&
    Math.abs(queryOrder - targetOrder) === 1 &&
    link.allowed &&
    link.source.identity >= config.link.threshold
  );
}

export function recordsForPreview(scene, preview, { includeClusters = false } = {}) {
  if (!preview) return null;
  if (preview.type === "cluster-drag" && !includeClusters) {
    return {
      // Genes, tracks, and instanced link ribbons all resolve their row
      // offsets on the GPU, leaving only a compact visible-link index list to
      // upload while the pointer moves.
      loci: new Set(),
      genes: new Set(),
      links: new Set(),
      clusterOffsets: true,
    };
  }
  const loci = new Set();
  if (preview.type === "cluster-drag") {
    for (const locus of scene.loci.values()) {
      if (clusterOffsetForPreview(preview, locus.cluster.uid)) loci.add(locus.source.uid);
    }
  }
  if (preview.type === "locus-offsets") {
    for (const locusUid of preview.locusOffsets.keys()) loci.add(locusUid);
  }
  if (preview.type === "locus-flip") {
    for (const uid of preview.axes.keys()) loci.add(uid);
    for (const uid of preview.locusOffsets?.keys() || []) loci.add(uid);
    if (preview.clusterOffsets?.size) for (const locus of scene.loci.values()) {
      if (preview.clusterOffsets.has(locus.cluster.uid)) loci.add(locus.source.uid);
    }
  }
  if (preview.type === "locus-trim") {
    const trimmed = scene.loci.get(preview.locusUid);
    const clusterUid = trimmed?.cluster?.uid ?? trimmed?.source?.clusterUid;
    // getLocusScaleValues packs loci independently within each cluster. A
    // trim can therefore shift every sibling locus even when its individual
    // offset happens to be zero in a particular preview frame.
    for (const locus of scene.loci.values()) {
      if ((locus.cluster?.uid ?? locus.source?.clusterUid) === clusterUid) loci.add(locus.source.uid);
    }
  }
  const genes = new Set();
  for (const uid of loci) {
    for (const gene of scene.loci.get(uid)?.genes || []) genes.add(gene.source.uid);
  }
  const links = new Set();
  if (scene.linksByGene) {
    for (const uid of genes) {
      for (const link of scene.linksByGene.get(uid) || []) links.add(link.uid);
    }
  } else {
    for (const link of scene.links.values()) {
      if (genes.has(endpointGeneId(link.source.query)) || genes.has(endpointGeneId(link.source.target))) links.add(link.source.uid);
    }
  }
  for (const uid of loci) for (const link of scene.linksByLocus?.get(uid) || []) links.add(link.uid);
  return { loci, genes, links };
}

export function genePolygonForPreview(preview, gene, { includeClusterOffset = true } = {}) {
  const { x, y } = previewOffsetsForLocus(preview, gene.locus);
  // Retained GPU vertices and SVG children apply cluster rows at their parent.
  const bakedY = includeClusterOffset ? y : 0;
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

/** Visible preview rows and their adjacent cluster pairs, shared by raster backends. */
export function clusterPreviewInViewport(scene, preview, viewport, { includeLinks = true } = {}) {
  const clusters = [...scene.clusters.values()].filter((cluster) => boundsInViewport(
    cluster.bounds, viewport, { y: clusterOffsetForPreview(preview, cluster.source.uid) }
  ));
  const pairs = new Set();
  if (includeLinks) {
    const clusterUidByOrder = new Map([...preview.clusterOrder].map(([uid, order]) => [order, uid]));
    for (const cluster of clusters) {
      const order = preview.clusterOrder.get(cluster.source.uid);
      for (const neighbourOrder of [order - 1, order + 1]) {
        const neighbour = clusterUidByOrder.get(neighbourOrder);
        if (neighbour !== undefined) pairs.add(clusterPairKey(cluster.source.uid, neighbour));
      }
    }
  }
  return { clusters, pairs };
}

const interpolateNumber = (from, to, amount) => from + (to - from) * amount;

function interpolateFields(from, to, amount, fields = ["x", "y"]) {
  if (!from || !to || from === to) return to;
  const result = { ...to };
  for (const field of fields) result[field] = interpolateNumber(from[field] ?? to[field], to[field], amount);
  return result;
}

function interpolateArray(from, to, amount) {
  if (!from || !to || from.length !== to.length) return to;
  return to.map((value, index) => interpolateNumber(from[index], value, amount));
}

function interpolateLocus(from, to, amount) {
  if (!from) return to;
  const trackX = (locus, side) =>
    locus.track[side] ??
    locus[side === "x1" ? "worldStart" : "worldEnd"] - locus.x;
  return {
    ...interpolateFields(from, to, amount, ["x", "y", "worldStart", "worldEnd"]),
    track: {
      ...to.track,
      x1: interpolateNumber(trackX(from, "x1"), trackX(to, "x1"), amount),
      x2: interpolateNumber(trackX(from, "x2"), trackX(to, "x2"), amount),
      y: interpolateNumber(from.track.y, to.track.y, amount),
    },
    hover: interpolateFields(from.hover, to.hover, amount,
      ["x", "y", "width", "height", "leftHandleX", "rightHandleX"]),
  };
}

/**
 * Interpolate compatible scene geometry for animation. Sources,
 * hit-regions, and semantic state remain those of the target scene; only the
 * pixels in flight are interpolated.
 */
export function interpolateScene(previous, scene, amount) {
  if (!previous || amount >= 1) return scene;
  const loci = new Map();
  for (const [uid, locus] of scene.loci) {
    loci.set(uid, interpolateLocus(previous.loci.get(uid), locus, amount));
  }

  const clusters = new Map();
  for (const [uid, cluster] of scene.clusters) {
    const prior = previous.clusters.get(uid);
    clusters.set(uid, {
      ...interpolateFields(prior, cluster, amount),
      info: interpolateFields(prior?.info, cluster.info, amount),
      loci: cluster.loci.map((locus) => loci.get(locus.source.uid)),
    });
  }

  const genes = new Map();
  for (const [uid, gene] of scene.genes) {
    const prior = previous.genes.get(uid);
    genes.set(uid, {
      ...gene,
      polygon: interpolateArray(prior?.polygon, gene.polygon, amount),
      locus: interpolateFields(prior?.locus, gene.locus, amount),
      label: interpolateFields(prior?.label, gene.label, amount, ["x", "y", "rotation"]),
    });
  }

  const previousBounds = previous.index?.links?.boundsById;
  const nextBounds = scene.index?.links?.boundsById;
  // Only links with geometry at either endpoint can fade or move. Fall back
  // to all records for external compact scenes without spatial indexes.
  const candidates = previousBounds && nextBounds
    ? new Set([...previousBounds.keys(), ...nextBounds.keys()]) : scene.links.keys();
  const changedLinks = new Map();
  for (const uid of candidates) {
    const link = scene.links.get(uid);
    if (!link) continue;
    const prior = previous.links.get(uid);
    // Invisible links cannot contribute to this transition. Preserve their
    // retained record for drag previews without allocating an interpolated
    // object and geometry on every animation frame.
    if (!prior?.visible && !link.visible) {
      continue;
    }
    const opacity = interpolateLinkOpacity(prior, link, amount);
    const anchors = interpolateLinkAnchors(previous, prior, scene, link, amount);
    changedLinks.set(uid, {
      ...link,
      // Retained scene link anchors are normalized upper-to-lower. During a
      // row swap that reverses which endpoint is upper, so interpolate in
      // stable query/target order to keep each end attached to its gene.
      anchors,
      labelPosition: interpolateFields(prior?.labelPosition, link.labelPosition, amount),
      opacity,
      visible: opacity > 0 && Boolean(prior?.visible || link.visible),
    });
  }
  const links = overlayLinkRecords(scene.links, changedLinks);
  const animationLinkIds = previousBounds && nextBounds
    ? [...changedLinks.keys()].sort((a, b) => scene.links.get(a).order - scene.links.get(b).order) : null;

  const priorPanels = new Map((previous.annotationPanels || []).map((panel) => [panel.uid, panel]));
  const annotationPanels = (scene.annotationPanels || []).map((panel) => ({ ...panel,
    x: interpolateNumber(priorPanels.get(panel.uid)?.x ?? panel.x, panel.x, amount) }));
  return { ...scene, clusters, loci, genes, links, annotationPanels, animationLinkIds };
}
