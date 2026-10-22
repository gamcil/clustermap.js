/** Selection shared by flat rows, tree leaves and annotation matrices. */
export class RowSelection extends Set {
  #anchor = null;

  select(id, checked, { orderedIds = [], range = false, idsFor = (id) => [id] } = {}) {
    const start = orderedIds.indexOf(this.#anchor), end = orderedIds.indexOf(id);
    const ids = range && start >= 0 && end >= 0
      ? orderedIds.slice(Math.min(start, end), Math.max(start, end) + 1) : [id];
    const anchor = range && start >= 0 ? this.#anchor : id;
    this.setMany(ids.flatMap(idsFor), checked);
    this.#anchor = anchor;
  }

  setMany(ids, checked = true) {
    for (const id of ids) { if (checked) this.add(id); else this.delete(id); }
    this.#anchor = null;
  }

  prune(ids, anchorIds = ids) {
    const valid = ids instanceof Set ? ids : new Set(ids);
    for (const id of this) if (!valid.has(id)) this.delete(id);
    const anchors = anchorIds === ids ? valid : new Set(anchorIds);
    if (!anchors.has(this.#anchor)) this.#anchor = null;
  }

  clear() { super.clear(); this.#anchor = null; }
}
