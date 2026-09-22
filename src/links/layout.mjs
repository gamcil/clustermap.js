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

  if (!areClustersAdjacent(query._cluster, target._cluster)) return null;

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

export function straightLinkPath([ax1, ax2, ay, bx1, bx2, by]) {
  return `M${ax1},${ay} L${ax2},${ay} L${bx2},${by} L${bx1},${by} L${ax1},${ay}`;
}

export function sankeyLinkPath([ax1, ax2, ay, bx1, bx2, by]) {
  const verticalMidpoint = ay + Math.abs(by - ay) / 2;
  return `M${ax2},${ay}C${ax2},${verticalMidpoint},${bx2},${verticalMidpoint},${bx2},${by}L${bx1},${by}C${bx1},${verticalMidpoint},${ax1},${verticalMidpoint},${ax1},${ay}L${ax2},${ay}`;
}

export function lineLinkPath([ax1, ax2, ay, bx1, bx2, by], straight) {
  const aMid = ax1 + (ax2 - ax1) / 2;
  const bMid = bx1 + (bx2 - bx1) / 2;
  if (straight) return `M${aMid},${ay} L${bMid},${by}`;

  const verticalMidpoint = (ay + by) / 2;
  return `M${aMid},${ay}C${aMid},${verticalMidpoint},${bMid},${verticalMidpoint},${bMid},${by}`;
}

export function getLinkPath(anchors, { asLine, straight }) {
  if (!anchors) return "";
  if (asLine) return lineLinkPath(anchors, straight);
  return straight ? straightLinkPath(anchors) : sankeyLinkPath(anchors);
}
