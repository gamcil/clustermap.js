export function getGenePolygonCoordinates(gene, { scaleX, shape }) {
  const scaledStart = scaleX(gene.start);
  const scaledEnd = scaleX(gene.end);
  const geneLength = scaledEnd - scaledStart;
  const bottom = shape.tipHeight * 2 + shape.bodyHeight;
  const midpoint = bottom / 2;
  const third = shape.tipHeight + shape.bodyHeight;
  let points;

  if (gene.strand === 1) {
    const shaft = scaledEnd - shape.tipLength;
    points = [
      scaledStart,
      shape.tipHeight,
      shaft,
      shape.tipHeight,
      shaft,
      0,
      scaledEnd,
      midpoint,
      shaft,
      bottom,
      shaft,
      third,
      scaledStart,
      third,
    ];
    if (geneLength < shape.tipLength) {
      [2, 4, 8, 10].forEach((index) => (points[index] = scaledStart));
    }
  } else {
    const shaft = scaledStart + shape.tipLength;
    points = [
      scaledEnd,
      shape.tipHeight,
      shaft,
      shape.tipHeight,
      shaft,
      0,
      scaledStart,
      midpoint,
      shaft,
      bottom,
      shaft,
      third,
      scaledEnd,
      third,
    ];
    if (geneLength < shape.tipLength) {
      [2, 4, 8, 10].forEach((index) => (points[index] = scaledEnd));
    }
  }

  return points;
}

export function getGenePolygonPoints(gene, options) {
  return getGenePolygonCoordinates(gene, options).join(" ");
}

export function getGeneLabelTransform(gene, { scaleX, shape, label }) {
  const scaledLength = scaleX(gene.end) - scaleX(gene.start);
  const x = scaleX(gene.start) + scaledLength * label.start;
  let y;

  if (label.position === "middle") {
    y = shape.tipHeight + shape.bodyHeight / 2;
  } else if (label.position === "bottom") {
    y = 2 * shape.tipHeight + shape.bodyHeight + label.spacing;
  } else {
    y = -label.spacing;
  }

  const rotation = ["start", "middle"].includes(label.anchor)
    ? -label.rotation
    : label.rotation;
  return `translate(${x}, ${y}) rotate(${rotation})`;
}

export function getGeneLabelDy(position) {
  switch (position) {
    case "top":
      return "-0.4em";
    case "middle":
      return "0.4em";
    case "bottom":
      return "0.8em";
    default:
      return undefined;
  }
}
