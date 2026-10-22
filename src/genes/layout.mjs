export function getGenePolygonCoordinates(gene, { scaleX, shape }) {
  const start = scaleX(gene.start), end = scaleX(gene.end);
  const forward = gene.strand === 1;
  const tail = forward ? start : end;
  const tip = forward ? end : start;
  const shaft = end - start < shape.tipLength ? tail
    : tip + (forward ? -shape.tipLength : shape.tipLength);
  const bottom = shape.tipHeight * 2 + shape.bodyHeight;
  return [
    tail, shape.tipHeight,
    shaft, shape.tipHeight,
    shaft, 0,
    tip, bottom / 2,
    shaft, bottom,
    shaft, shape.tipHeight + shape.bodyHeight,
    tail, shape.tipHeight + shape.bodyHeight,
  ];
}

export function getGeneLabelLayout(gene, { scaleX, shape, label }) {
  const start = scaleX(gene.start), end = scaleX(gene.end);
  const x = start + (end - start) * label.start;
  let y;

  if (label.position === "middle") {
    y = shape.tipHeight + shape.bodyHeight / 2;
  } else if (label.position === "bottom") {
    y = 2 * shape.tipHeight + shape.bodyHeight + label.spacing;
  } else {
    y = -label.spacing;
  }

  return {
    x,
    y,
    rotation: ["start", "middle"].includes(label.anchor)
      ? -label.rotation
      : label.rotation,
  };
}
