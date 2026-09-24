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

function cellsForBounds(bounds, { cellWidth, cellHeight }) {
  if (!validBounds(bounds)) return [];
  const cells = [];
  const minColumn = Math.floor(bounds.minX / cellWidth);
  const maxColumn = Math.floor(bounds.maxX / cellWidth);
  const minRow = Math.floor(bounds.minY / cellHeight);
  const maxRow = Math.floor(bounds.maxY / cellHeight);
  for (let column = minColumn; column <= maxColumn; column += 1) {
    for (let row = minRow; row <= maxRow; row += 1) cells.push(cellKey(column, row));
  }
  return cells;
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
  const orderById = new Map();
  let order = 0;
  for (const [id, bounds] of records) {
    if (!validBounds(bounds)) continue;
    boundsById.set(id, bounds);
    orderById.set(id, order);
    order += 1;
    for (const key of cellsForBounds(bounds, { cellWidth, cellHeight })) {
      if (!cells.has(key)) cells.set(key, new Set());
      cells.get(key).add(id);
    }
  }
  return { cells, boundsById, orderById, cellWidth, cellHeight };
}

/**
 * Return a copy of an index with a small set of existing records moved or
 * removed. Scene patches use this to retain spatial lookup for untouched
 * records instead of rebuilding an index for the entire chart.
 */
export function patchSpatialIndex(index, entries) {
  if (!index || !entries?.length) return index;
  const cells = new Map(index.cells);
  const boundsById = new Map(index.boundsById);
  const changedCells = new Set();
  const mutableCell = (key) => {
    if (!changedCells.has(key) || !cells.has(key)) {
      cells.set(key, new Set(cells.get(key)));
      changedCells.add(key);
    }
    return cells.get(key);
  };

  for (const [id, bounds] of entries) {
    const oldBounds = boundsById.get(id);
    for (const key of cellsForBounds(oldBounds, index)) {
      const cell = mutableCell(key);
      cell.delete(id);
      if (cell.size === 0) cells.delete(key);
    }
    if (!validBounds(bounds)) {
      boundsById.delete(id);
      continue;
    }
    boundsById.set(id, bounds);
    for (const key of cellsForBounds(bounds, index)) {
      const cell = mutableCell(key);
      cell.add(id);
    }
  }
  return { ...index, cells, boundsById };
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

/**
 * Return viewport candidates in the order they were added to the index. This
 * preserves deterministic painter order while allowing a renderer to visit
 * only visible records.
 */
export function queryViewportOrdered(index, viewport) {
  return [...queryViewport(index, viewport)].sort(
    (left, right) => index.orderById.get(left) - index.orderById.get(right)
  );
}

/** Return IDs whose exact bounds contain a world-space point. */
export function queryPoint(index, point) {
  const candidates = pointCandidates(index, point);
  return new Set(candidates);
}

function pointCandidates(index, point) {
  return [...queryViewport(index, {
    minX: point.x,
    maxX: point.x,
    minY: point.y,
    maxY: point.y,
  })].filter((id) => {
    const bounds = index.boundsById.get(id);
    return (
      point.x >= bounds.minX &&
      point.x <= bounds.maxX &&
      point.y >= bounds.minY &&
      point.y <= bounds.maxY
    );
  });
}

/** Return point candidates in the order they were added to the index. */
export function queryPointOrdered(index, point) {
  return pointCandidates(index, point).sort(
    (left, right) => index.orderById.get(left) - index.orderById.get(right)
  );
}
