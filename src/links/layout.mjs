export function clusterPairKey(left, right) {
  return left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`;
}

export function endpointGeneId(endpoint) {
  return endpoint.kind === "span" ? undefined : endpoint.geneId ?? endpoint.uid;
}

export function endpointLocus(endpoint, { genes, loci }) {
  return endpoint.kind === "span" ? loci?.get(endpoint.locusId) : genes.get(endpointGeneId(endpoint))?.locus;
}

/** Project a biological endpoint into the displayed locus coordinate system. */
export function projectLinkEndpoint(endpoint, { genes, loci, scaleX, scaleGenes = true }) {
  if (endpoint.kind !== "span") {
    const gene = genes.get(endpointGeneId(endpoint));
    if (!gene) return null;
    const { display, locus } = gene;
    const start = scaleX(display.start) + locus.x, end = scaleX(display.end) + locus.x;
    return { locus, visible: gene.visible,
      anchors: display.strand === 1 ? [start, end, locus.y + locus.track.y] : [end, start, locus.y + locus.track.y] };
  }
  const locus = loci?.get(endpoint.locusId);
  if (!locus || !scaleGenes) return null;
  const origin = (locus.source.bio || locus.source).start;
  let start = endpoint.start - origin, end = endpoint.end - origin;
  if (locus.state.flipped) [start, end] = [locus.source.end - end, locus.source.end - start];
  const visible = start >= locus.state.start && end <= locus.state.end;
  const left = scaleX(start) + locus.x, right = scaleX(end) + locus.x;
  return { locus, visible, anchors: locus.state.flipped
    ? [right, left, locus.y + locus.track.y] : [left, right, locus.y + locus.track.y] };
}

/** Resolve endpoint geometry from a retained scene without rebuilding scales. */
export function projectSceneEndpoint(endpoint, scene) {
  const locus = endpointLocus(endpoint, scene);
  if (!locus) return null;
  const length = locus.state.end - locus.state.start;
  if (!length) return null;
  const factor = (locus.worldEnd - locus.worldStart) / length;
  const scaleX = (value) => locus.worldStart - locus.x + (value - locus.state.start) * factor;
  return projectLinkEndpoint(endpoint, { ...scene, scaleX });
}

/** Keep each gene's directional endpoints together, with the upper row first. */
export function orderLinkAnchors(query, target) {
  return query[2] > target[2] ? [...target, ...query] : [...query, ...target];
}

export function interpolateLinkOpacity(previous, next, amount, enabled = true) {
  const isRenderable = (link) => Boolean(enabled && link?.visible && link?.anchors);
  const from = isRenderable(previous) ? 1 : 0;
  const to = isRenderable(next) ? 1 : 0;
  return from + (to - from) * amount;
}

export function interpolateLinkAnchors(previousScene, previous, nextScene, next, amount) {
  const inQueryOrder = (scene, link) => {
    if (!link?.anchors) return null;
    const queryY = scene && endpointLocus(link.source.query, scene)?.y;
    if (!Number.isFinite(queryY)) return link.anchors;
    const anchors = link.anchors;
    const queryFirst = Math.abs(anchors[2] - queryY) <= Math.abs(anchors[5] - queryY);
    return queryFirst ? anchors : [anchors[3], anchors[4], anchors[5], anchors[0], anchors[1], anchors[2]];
  };
  const from = inQueryOrder(previousScene, previous);
  const to = inQueryOrder(nextScene, next);
  if (!from) return to;
  if (!to) return from;
  return to.map((value, index) => from[index] + (value - from[index]) * amount);
}

export function getLinkLabelPosition(
  [ax1, ax2, ay, bx1, bx2, by],
  position
) {
  const aMid = ax1 + (ax2 - ax1) / 2;
  const bMid = bx1 + (bx2 - bx1) / 2;
  return {
    x: aMid + (bMid - aMid) * position,
    y: ay + (by - ay) * position,
  };
}

export function linkPathCommands(anchors, { asLine = false, straight = false } = {}) {
  if (!anchors) return [];
  const [ax1, ax2, ay, bx1, bx2, by] = anchors;
  const aMid = ax1 + (ax2 - ax1) / 2;
  const bMid = bx1 + (bx2 - bx1) / 2;
  const middle = ay + (by - ay) / 2;
  if (asLine) {
    return straight
      ? [["M", aMid, ay], ["L", bMid, by]]
      : [["M", aMid, ay], ["C", aMid, middle, bMid, middle, bMid, by]];
  }
  return straight
    ? [["M", ax1, ay], ["L", ax2, ay], ["L", bx2, by], ["L", bx1, by], ["L", ax1, ay], ["Z"]]
    : [
        ["M", ax2, ay],
        ["C", ax2, middle, bx2, middle, bx2, by],
        ["L", bx1, by],
        ["C", bx1, middle, ax1, middle, ax1, ay],
        ["Z"],
      ];
}

/** Trace the same link shape used by SVG onto a Canvas context. */
export function traceLinkPath(context, anchors, style) {
  for (const [command, ...values] of linkPathCommands(anchors, style)) {
    if (command === "M") context.moveTo(...values);
    else if (command === "L") context.lineTo(...values);
    else if (command === "C") context.bezierCurveTo(...values);
    else context.closePath();
  }
}

/**
 * Sample a link in world coordinates for renderers that submit triangles and
 * line segments directly rather than accepting SVG/Canvas path commands.
 */
export function sampleLinkGeometry(anchors, { asLine = false, straight = false, segments = 10 } = {}) {
  if (!anchors) return { asLine, upper: [], lower: [], line: [] };
  const [ax1, ax2, ay, bx1, bx2, by] = anchors;
  const middle = ay + (by - ay) / 2;
  const pointFor = (startX, endX, amount) => straight
    ? [startX + (endX - startX) * amount, ay + (by - ay) * amount]
    : [
        cubic(startX, startX, endX, endX, amount),
        cubic(ay, middle, middle, by, amount),
      ];
  const count = straight ? 1 : Math.max(1, segments);
  const samples = (startX, endX) => Array.from(
    { length: count + 1 },
    (_, index) => pointFor(startX, endX, index / count)
  );
  if (asLine) return {
    asLine,
    upper: [],
    lower: [],
    line: samples((ax1 + ax2) / 2, (bx1 + bx2) / 2),
  };
  return { asLine, upper: samples(ax2, bx2), lower: samples(ax1, bx1), line: [] };
}

function cubic(start, controlA, controlB, end, amount) {
  const inverse = 1 - amount;
  return (
    inverse * inverse * inverse * start +
    3 * inverse * inverse * amount * controlA +
    3 * inverse * amount * amount * controlB +
    amount * amount * amount * end
  );
}

export function getLinkPath(anchors, style) {
  return linkPathCommands(anchors, style)
    .map(([command, ...values]) => `${command}${values.join(",")}`)
    .join("");
}
