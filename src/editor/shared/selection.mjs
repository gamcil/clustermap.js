import { selectionRange } from "../../interaction/selection.mjs";

/** Selection shared by flat rows, tree leaves and annotation matrices. */
export class RowSelection extends Set {
  #anchor = null;

  select(id, checked, { orderedIds = [], range = false, idsFor = (id) => [id] } = {}) {
    const { ids, anchor } = selectionRange(orderedIds, this.#anchor, id, range);
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
