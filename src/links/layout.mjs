export function getLinkAnchors(
  link,
  {
    geneForUid,
    areClustersAdjacent,
    scaleX,
    horizontalOffset,
    verticalPosition,
    geneMidpoint,
  }
) {
  const query = geneForUid(link.query.uid);
  const target = geneForUid(link.target.uid);

  if (!areClustersAdjacent(query.clusterUid, target.clusterUid)) return null;

  const getGeneAnchors = (gene) => {
    const offset = horizontalOffset(gene);
    const left = scaleX(gene.start) + offset;
    const right = scaleX(gene.end) + offset;
    const forward = gene.strand === 1;
    return [
      forward ? left : right,
      forward ? right : left,
      verticalPosition(gene) + geneMidpoint,
    ];
  };

  const [ax1, ax2, ay] = getGeneAnchors(query);
  const [bx1, bx2, by] = getGeneAnchors(target);

  return ay > by
    ? [bx1, bx2, by, ax1, ax2, ay]
    : [ax1, ax2, ay, bx1, bx2, by];
}

export function getLinkLabelPosition(
  [ax1, ax2, ay, bx1, bx2, by],
  position
) {
  const aMid = ax1 + (ax2 - ax1) / 2;
  const bMid = bx1 + (bx2 - bx1) / 2;
  return {
    x: aMid + (bMid - aMid) * position,
    y: ay + Math.abs(by - ay) * position,
  };
}

export function linkPathCommands(anchors, { asLine = false, straight = false } = {}) {
  if (!anchors) return [];
  const [ax1, ax2, ay, bx1, bx2, by] = anchors;
  const aMid = ax1 + (ax2 - ax1) / 2;
  const bMid = bx1 + (bx2 - bx1) / 2;
  const middle = ay + Math.abs(by - ay) / 2;
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
  const middle = ay + Math.abs(by - ay) / 2;
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
