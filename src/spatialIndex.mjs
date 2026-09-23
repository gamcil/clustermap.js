const DEFAULT_CELL_WIDTH = 100;
const DEFAULT_CELL_HEIGHT = 50;

function cellKey(x, y) {
  return `${x},${y}`;
}

function validBounds(bounds) {
  return (
    bounds &&
    Number.isFinite(bounds.minX) &&
    Number.isFinite(bounds.maxX) &&
    Number.isFinite(bounds.minY) &&
    Number.isFinite(bounds.maxY)
  );
}

function intersects(one, two) {
  return (
    one.minX <= two.maxX &&
    one.maxX >= two.minX &&
    one.minY <= two.maxY &&
    one.maxY >= two.minY
  );
}

/**
 * Index world-space rectangular extents in a uniform grid. The index stores
 * IDs only; callers retain ownership of the scene records and draw order.
 */
export function createSpatialIndex(
  records,
  { cellWidth = DEFAULT_CELL_WIDTH, cellHeight = DEFAULT_CELL_HEIGHT } = {}
) {
  const cells = new Map();
  const boundsById = new Map();
  for (const [id, bounds] of records) {
    if (!validBounds(bounds)) continue;
    boundsById.set(id, bounds);
    const minColumn = Math.floor(bounds.minX / cellWidth);
    const maxColumn = Math.floor(bounds.maxX / cellWidth);
    const minRow = Math.floor(bounds.minY / cellHeight);
    const maxRow = Math.floor(bounds.maxY / cellHeight);
    for (let column = minColumn; column <= maxColumn; column += 1) {
      for (let row = minRow; row <= maxRow; row += 1) {
        const key = cellKey(column, row);
        if (!cells.has(key)) cells.set(key, new Set());
        cells.get(key).add(id);
      }
    }
  }
  return { cells, boundsById, cellWidth, cellHeight };
}

/** Return candidate IDs whose exact bounds intersect a world-space viewport. */
export function queryViewport(index, viewport) {
  if (!validBounds(viewport)) return new Set();
  const matches = new Set();
  const minColumn = Math.floor(viewport.minX / index.cellWidth);
  const maxColumn = Math.floor(viewport.maxX / index.cellWidth);
  const minRow = Math.floor(viewport.minY / index.cellHeight);
  const maxRow = Math.floor(viewport.maxY / index.cellHeight);
  for (let column = minColumn; column <= maxColumn; column += 1) {
    for (let row = minRow; row <= maxRow; row += 1) {
      for (const id of index.cells.get(cellKey(column, row)) || []) {
        if (intersects(index.boundsById.get(id), viewport)) matches.add(id);
      }
    }
  }
  return matches;
}

/** Return IDs whose exact bounds contain a world-space point. */
export function queryPoint(index, point) {
  const candidates = queryViewport(index, {
    minX: point.x,
    maxX: point.x,
    minY: point.y,
    maxY: point.y,
  });
  return new Set(
    [...candidates].filter((id) => {
      const bounds = index.boundsById.get(id);
      return (
        point.x >= bounds.minX &&
        point.x <= bounds.maxX &&
        point.y >= bounds.minY &&
        point.y <= bounds.maxY
      );
    })
  );
}
