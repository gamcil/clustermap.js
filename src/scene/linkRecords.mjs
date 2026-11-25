// Scene edits preserve the previous scene for animation. Copying a multi-million
// entry Map for a small edit is expensive, so share a stable base and replace
// only changed records. Periodically compact to bound retained overrides.
class PatchedLinkRecords {
  constructor(base, changes) { this.base = base; this.changes = changes; }
  get size() { return this.base.size; }
  get(uid) { return this.changes.has(uid) ? this.changes.get(uid) : this.base.get(uid); }
  has(uid) { return this.base.has(uid); }
  *entries() {
    for (const [uid, record] of this.base) yield [uid, this.changes.has(uid) ? this.changes.get(uid) : record];
  }
  *keys() { yield* this.base.keys(); }
  *values() { for (const [, record] of this.entries()) yield record; }
  [Symbol.iterator]() { return this.entries(); }
}

// An animation frame is transient and never patched again; layer its small
// changes over the target scene without copying its persistent edit overlay.
export function overlayLinkRecords(records, changes) {
  return changes.size ? new PatchedLinkRecords(records, changes) : records;
}

export function patchLinkRecords(records, changes) {
  if (!changes.size) return records;
  const base = records instanceof PatchedLinkRecords ? records.base : records;
  const combined = records instanceof PatchedLinkRecords ? new Map(records.changes) : new Map();
  for (const [uid, record] of changes) {
    if (!base.has(uid)) throw new TypeError("Link scene patches cannot add records.");
    combined.set(uid, record);
  }
  if (combined.size > base.size / 4) {
    const compacted = new Map(base);
    for (const [uid, record] of combined) compacted.set(uid, record);
    return compacted;
  }
  return new PatchedLinkRecords(base, combined);
}
