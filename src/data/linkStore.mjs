import { isPlainObject } from "../utils/values.mjs";
import { validateRecordFields } from "./validation.mjs";
import { COMPACT_LINK_VIEW } from "./linkRead.mjs";

// Link stores retain source order and provide stable ID-to-position lookup.
// Array stores retain record identity because editing currently mutates records.
export class ArrayLinkStore {
  constructor(links) {
    this.links = links;
    this.positions = new Map();
    for (let position = 0; position < links.length; position++) this.positions.set(links[position].uid, position);
  }
  get size() { return this.positions.size; }
  has(uid) { return this.positions.has(uid); }
  order(uid) { return this.positions.get(uid); }
  getAt(position) { return this.links[position]; }
  uidAt(position) { return this.links[position]?.uid; }
  get(uid) { const position = this.order(uid); return position === undefined ? undefined : this.getAt(position); }
  *keys() { yield* this.positions.keys(); }
  *values() { for (const uid of this.positions.keys()) yield this.get(uid); }
  *entries() { for (const uid of this.positions.keys()) yield [uid, this.get(uid)]; }
  [Symbol.iterator]() { return this.entries(); }
}

// Immutable columnar link table for canonical, ordered Clinker link IDs.
// Inputs are copied: callers can mutate their arrays without affecting a chart
// or an old scene. Sparse edit overlays share the immutable columns.
const sharedColumns = Symbol("shared compact columns");
const transferredColumns = Symbol("transferred compact columns");
const editableFields = new Set(["label", "colour", "hidden", "identity"]);
function validateCompactColumns({ genes, query, target, identity, similarity } = {}) {
  if (!Array.isArray(genes) || !genes.every((uid) => typeof uid === "string" && uid.length)) {
    throw new TypeError("Compact links require a gene ID dictionary.");
  }
  if (!(query instanceof Uint32Array) || !(target instanceof Uint32Array) ||
      !(identity instanceof Float64Array || identity instanceof Float32Array) ||
      !(similarity instanceof Float64Array || similarity instanceof Float32Array) ||
      query.length !== target.length || query.length !== identity.length || query.length !== similarity.length) {
    throw new TypeError("Compact link columns must be equal-length Uint32 and Float32/Float64 arrays.");
  }
  for (let i = 0; i < query.length; i++) {
    if (query[i] >= genes.length || target[i] >= genes.length || !Number.isFinite(identity[i]) ||
        identity[i] < 0 || identity[i] > 1 || !Number.isFinite(similarity[i])) {
      throw new TypeError(`Invalid compact link at position ${i}.`);
    }
  }
}
export class CompactLinkStore {
  static get supportsFloat32Scores() { return true; }
  #genes; #query; #target; #identity; #similarity; #overrides; #deleted; #fingerprint; #activePositions;
  constructor(input, mode = null) {
    if (mode === sharedColumns) {
      this.#genes = input.#genes; this.#query = input.#query; this.#target = input.#target;
      this.#identity = input.#identity; this.#similarity = input.#similarity;
      this.#overrides = new Map(input.#overrides);
      this.#deleted = input.#deleted.slice();
      this.#fingerprint = input.#fingerprint;
      this.#activePositions = input.#activePositions;
      return;
    }
    const { genes, query, target, identity, similarity } = input;
    // Transferred columns have already been validated before ownership moved.
    if (mode !== transferredColumns) validateCompactColumns({ genes, query, target, identity, similarity });
    this.#genes = Object.freeze([...genes]);
    this.#query = mode === transferredColumns ? query : query.slice();
    this.#target = mode === transferredColumns ? target : target.slice();
    this.#identity = mode === transferredColumns ? identity : identity.slice();
    this.#similarity = mode === transferredColumns ? similarity : similarity.slice();
    this.#overrides = new Map();
    this.#deleted = [];
    this.#fingerprint = null;
    this.#activePositions = null;
  }
  // Explicit ownership transfer avoids the second copy of large columns.
  // All views of the transferred buffers in the caller become detached.
  static fromTransferred(input) {
    const { genes, query, target, identity, similarity } = input || {};
    validateCompactColumns({ genes, query, target, identity, similarity });
    const columns = [query, target, identity, similarity];
    if (columns.some((column) => !(column.buffer instanceof ArrayBuffer))) {
      throw new TypeError("Compact link transfer requires transferable ArrayBuffers.");
    }
    const moved = structuredClone({ query, target, identity, similarity },
      { transfer: [...new Set(columns.map((column) => column.buffer))] });
    return new CompactLinkStore({ genes, ...moved }, transferredColumns);
  }
  get size() { return this.#query.length - this.#deleted.length; }
  get geneCount() { return this.#genes.length; }
  geneAt(position) { return this.#genes[position]; }
  get byteLength() { return this.#query.byteLength + this.#target.byteLength + this.#identity.byteLength + this.#similarity.byteLength; }
  #deletedBefore(position) {
    let low = 0, high = this.#deleted.length;
    while (low < high) { const middle = (low + high) >>> 1;
      if (this.#deleted[middle] < position) low = middle + 1; else high = middle; }
    return low;
  }
  #physicalForUid(uid) {
    if (typeof uid !== "string" || !/^link-(0|[1-9]\d*)$/.test(uid)) return undefined;
    const position = Number(uid.slice(5));
    return Number.isSafeInteger(position) && position < this.#query.length ? position : undefined;
  }
  #physicalAt(position) {
    if (!Number.isInteger(position) || position < 0 || position >= this.size) return undefined;
    if (!this.#deleted.length) return position;
    if (this.#deleted.length === 1) return position < this.#deleted[0] ? position : position + 1;
    if (this.#deleted.length > 128) {
      if (!this.#activePositions) {
        const positions = new Uint32Array(this.size);
        let removed = 0, next = 0;
        for (let physical = 0; physical < this.#query.length; physical++) {
          if (this.#deleted[removed] === physical) removed++;
          else positions[next++] = physical;
        }
        this.#activePositions = positions;
      }
      return this.#activePositions[position];
    }
    let low = position, high = position + this.#deleted.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (middle - this.#deletedBefore(middle + 1) < position) low = middle + 1;
      else high = middle;
    }
    return low;
  }
  order(uid) {
    const position = this.#physicalForUid(uid);
    if (position === undefined) return undefined;
    const removedBefore = this.#deletedBefore(position);
    return this.#deleted[removedBefore] === position ? undefined : position - removedBefore;
  }
  has(uid) { return this.order(uid) !== undefined; }
  uidAt(position) { const physical = this.#physicalAt(position); return physical === undefined ? undefined : `link-${physical}`; }
  queryIndexAt(position) { const physical = this.#physicalAt(position); return this.#query[physical]; }
  targetIndexAt(position) { const physical = this.#physicalAt(position); return this.#target[physical]; }
  queryAt(position) { return this.#genes[this.queryIndexAt(position)]; }
  targetAt(position) { return this.#genes[this.targetIndexAt(position)]; }
  similarityAt(position) { return this.#similarity[this.#physicalAt(position)]; }
  identityAt(position) {
    const physical = this.#physicalAt(position), changes = this.#overrides.get(physical);
    return changes && Object.hasOwn(changes, "identity") ? changes.identity : this.#identity[physical];
  }
  hiddenAt(position) { return this.#overrides.get(this.#physicalAt(position))?.hidden; }
  labelAt(position) { return this.#overrides.get(this.#physicalAt(position))?.label; }
  getAt(position) {
    const physical = this.#physicalAt(position);
    if (physical === undefined) return undefined;
    return { uid: `link-${physical}`, query: { uid: this.#genes[this.#query[physical]] },
      target: { uid: this.#genes[this.#target[physical]] }, identity: this.#identity[physical],
      similarity: this.#similarity[physical], ...this.#overrides.get(physical) };
  }
  get(uid) { const position = this.order(uid); return position === undefined ? undefined : this.getAt(position); }
  // A deterministic checksum catches an accidentally mismatched base on load.
  // It is not a cryptographic integrity or authenticity guarantee.
  get fingerprint() {
    if (this.#fingerprint) return this.#fingerprint;
    let one = 0x811c9dc5, two = 0x9e3779b9;
    const add = (word) => { one = Math.imul(one ^ word, 0x01000193); two = Math.imul(two ^ word, 0x85ebca6b); };
    const bytes = new DataView(new ArrayBuffer(8));
    // JSON serializes -0 as 0, so both must produce the same durable identity.
    const addNumber = (value) => {
      bytes.setFloat64(0, value === 0 ? 0 : value, true);
      add(bytes.getUint32(0, true)); add(bytes.getUint32(4, true));
    };
    add(this.#genes.length); add(this.#query.length);
    for (const uid of this.#genes) { add(uid.length); for (let i = 0; i < uid.length; i++) add(uid.charCodeAt(i)); }
    for (let i = 0; i < this.#query.length; i++) {
      add(this.#query[i]); add(this.#target[i]);
      addNumber(this.#identity[i]); addNumber(this.#similarity[i]);
    }
    return this.#fingerprint = `cl1-${(one >>> 0).toString(16).padStart(8, "0")}${(two >>> 0).toString(16).padStart(8, "0")}`;
  }
  get isUnedited() { return this.#deleted.length === 0 && this.#overrides.size === 0; }
  sharesBase(other) {
    return other instanceof CompactLinkStore && this.#query === other.#query && this.#target === other.#target &&
      this.#identity === other.#identity && this.#similarity === other.#similarity && this.#genes === other.#genes;
  }
  // Only durable edits are saved: deleted records need no presentation overlay.
  snapshotEdits() {
    const deleted = this.#deleted.slice();
    const updates = [];
    for (const [position, changes] of [...this.#overrides].sort((a, b) => a[0] - b[0])) {
      if (this.#deleted[this.#deletedBefore(position)] === position) continue;
      const fields = Object.entries(changes).map(([key, value]) => value === undefined ? [key] : [key, value]);
      if (fields.length) updates.push([position, fields]);
    }
    return { version: 1, base: this.fingerprint, deleted, updates };
  }
  applyEdits(snapshot) {
    if (!this.isUnedited || !isPlainObject(snapshot) || snapshot.version !== 1 ||
        !Array.isArray(snapshot.deleted) || !Array.isArray(snapshot.updates)) {
      throw new TypeError("Invalid compact link edit snapshot or edited base.");
    }
    if (snapshot.base !== this.fingerprint) throw new TypeError("Compact link snapshot does not match its base table.");
    const removed = new Set();
    for (const position of snapshot.deleted) {
      if (!Number.isInteger(position) || position < 0 || position >= this.size || removed.has(position)) {
        throw new TypeError("Invalid compact link deletion snapshot.");
      }
      removed.add(position);
    }
    const seen = new Set(), updates = [];
    for (const entry of snapshot.updates) {
      if (!Array.isArray(entry) || entry.length !== 2 || !Number.isInteger(entry[0]) || entry[0] < 0 ||
          entry[0] >= this.size || removed.has(entry[0]) || seen.has(entry[0]) || !Array.isArray(entry[1]) || !entry[1].length) {
        throw new TypeError("Invalid compact link update snapshot.");
      }
      seen.add(entry[0]);
      const changes = {};
      for (const field of entry[1]) {
        if (!Array.isArray(field) || field.length < 1 || field.length > 2 || !editableFields.has(field[0]) || Object.hasOwn(changes, field[0])) {
          throw new TypeError("Invalid compact link update field.");
        }
        changes[field[0]] = field.length === 1 ? undefined : field[1];
      }
      updates.push({ uid: `link-${entry[0]}`, changes });
    }
    return this.withUpdates(updates).withDeleted([...removed].map((position) => `link-${position}`));
  }
  // Return a new view so older scenes and history retain their original data.
  withUpdates(updates) {
    if (!Array.isArray(updates)) throw new TypeError("Compact link updates must be an array.");
    const next = new CompactLinkStore(this, sharedColumns);
    for (const { uid, changes } of updates) {
      const position = this.order(uid);
      if (position === undefined) throw new TypeError(`Unknown compact link ID ${uid}.`);
      if (!isPlainObject(changes) || !Object.keys(changes).length || Object.keys(changes).some((key) => !editableFields.has(key))) {
        throw new TypeError("Compact link update contains unsupported fields.");
      }
      validateRecordFields(changes, (message) => { throw new TypeError(`Invalid compact link update: ${message}.`); });
      const physical = this.#physicalForUid(uid);
      next.#overrides.set(physical, { ...next.#overrides.get(physical), ...changes });
    }
    return next;
  }
  withDeleted(ids) {
    if (!Array.isArray(ids)) throw new TypeError("Compact link deletion requires IDs.");
    const next = new CompactLinkStore(this, sharedColumns), removed = new Set(next.#deleted);
    for (const uid of ids) {
      if (!this.has(uid)) throw new TypeError(`Unknown compact link ID ${uid}.`);
      removed.add(this.#physicalForUid(uid));
    }
    next.#deleted = [...removed].sort((a, b) => a - b);
    next.#activePositions = null;
    return next;
  }
  filterEndpoints(geneIds) {
    const next = new CompactLinkStore(this, sharedColumns), removed = [...this.#deleted];
    for (let position = 0; position < this.size; position++) {
      if (!geneIds.has(this.queryAt(position)) || !geneIds.has(this.targetAt(position))) removed.push(this.#physicalAt(position));
    }
    next.#deleted = removed.sort((a, b) => a - b);
    next.#activePositions = null;
    return next;
  }
  withRestored(records) {
    if (!Array.isArray(records)) throw new TypeError("Compact link restoration requires records.");
    const next = new CompactLinkStore(this, sharedColumns);
    for (const { index, link } of records) {
      const physical = next.#physicalForUid(link?.uid), deletedIndex = physical === undefined ? -1 : next.#deleted.indexOf(physical);
      if (deletedIndex < 0 || !isPlainObject(link.query) || !isPlainObject(link.target) ||
          Object.keys(link.query).some((key) => key !== "uid") || Object.keys(link.target).some((key) => key !== "uid") ||
          link.query.uid !== next.#genes[next.#query[physical]] ||
          link.target.uid !== next.#genes[next.#target[physical]] || link.similarity !== next.#similarity[physical] ||
          Object.keys(link).some((key) => !["uid", "query", "target", "similarity", "identity", "hidden", "label", "colour"].includes(key))) {
        throw new TypeError("Compact links can only restore deleted canonical records.");
      }
      next.#deleted.splice(deletedIndex, 1);
      next.#activePositions = null;
      if (next.order(link.uid) !== Math.min(index, next.size - 1)) throw new TypeError("Compact link restoration would change canonical order.");
      const changes = Object.fromEntries(Object.entries(link).filter(([key]) => editableFields.has(key)));
      validateRecordFields(changes, (message) => { throw new TypeError(`Invalid compact link restoration: ${message}.`); });
      next.#overrides.set(physical, changes);
    }
    return next;
  }
  *keys() { for (let i = 0; i < this.size; i++) yield this.uidAt(i); }
  *values() { for (let i = 0; i < this.size; i++) yield this.getAt(i); }
  *entries() { for (let i = 0; i < this.size; i++) { const link = this.getAt(i); yield [link.uid, link]; } }
  [Symbol.iterator]() { return this.entries(); }
}

// Preserve the public array-shaped read view without expanding compact links.
// Each record is materialized only when read; mutation belongs in chart.patch.
const arrayViews = new WeakMap();
export function linkArrayView(store) {
  let view = arrayViews.get(store);
  if (view) return view;
  const array = [];
  const indexOf = (key) => {
    if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key)) return null;
    const index = Number(key);
    return Number.isSafeInteger(index) && index < store.size ? index : null;
  };
  view = new Proxy(array, {
    get(target, key, receiver) {
      if (key === COMPACT_LINK_VIEW) return store;
      if (key === "length") return store.size;
      const index = indexOf(key);
      return index === null ? Reflect.get(target, key, receiver) : store.getAt(index);
    },
    has(target, key) { return indexOf(key) !== null || Reflect.has(target, key); },
    getOwnPropertyDescriptor(target, key) {
      const index = indexOf(key);
      return index === null ? Reflect.getOwnPropertyDescriptor(target, key)
        : { value: store.getAt(index), writable: false, enumerable: true, configurable: true };
    },
    ownKeys() { return [...Array.from({ length: store.size }, (_, index) => String(index)), "length"]; },
    set() { throw new TypeError("Chart data is read-only; use chart.patch()."); },
    deleteProperty() { throw new TypeError("Chart data is read-only; use chart.patch()."); },
    defineProperty() { throw new TypeError("Chart data is read-only; use chart.patch()."); },
  });
  arrayViews.set(store, view);
  return view;
}
