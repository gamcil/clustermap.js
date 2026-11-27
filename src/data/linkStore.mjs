import { isPlainObject, isRecordId } from "../utils/values.mjs";
import { validateRecordFields } from "./validation.mjs";

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
function validateCompactColumns({ genes, query, target, identity, similarity, spans = null, ids = null } = {}) {
  if (!Array.isArray(genes) || !genes.every(isRecordId)) {
    throw new TypeError("Compact links require a gene ID dictionary.");
  }
  if (!(query instanceof Uint32Array) || !(target instanceof Uint32Array) ||
      !(identity instanceof Float64Array || identity instanceof Float32Array) ||
      !(similarity instanceof Float64Array || similarity instanceof Float32Array) ||
      query.length !== target.length || query.length !== identity.length || query.length !== similarity.length) {
    throw new TypeError("Compact link columns must be equal-length Uint32 and Float32/Float64 arrays.");
  }
  if (ids !== null && (!Array.isArray(ids) || ids.length !== query.length || !ids.every(isRecordId) || new Set(ids).size !== ids.length)) {
    throw new TypeError("Compact link IDs must be unique record IDs matching the columns.");
  }
  if (spans && (!Array.isArray(spans.loci) || !spans.loci.every(isRecordId) ||
      !(spans.kinds instanceof Uint8Array) || !(spans.orientation instanceof Int8Array) ||
      ![spans.queryStart, spans.queryEnd, spans.targetStart, spans.targetEnd].every((column) => column instanceof Float64Array) ||
      [spans.kinds, spans.orientation, spans.queryStart, spans.queryEnd, spans.targetStart, spans.targetEnd].some((column) => column.length !== query.length))) {
    throw new TypeError("Compact span columns must have matching lengths and a locus dictionary.");
  }
  const validSpan = (start, end) => Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && end > start;
  for (let i = 0; i < query.length; i++) {
    const kinds = spans?.kinds[i] || 0;
    if (kinds > 3 || query[i] >= (kinds & 1 ? spans.loci.length : genes.length) ||
        target[i] >= (kinds & 2 ? spans.loci.length : genes.length) ||
        (kinds & 1 && !validSpan(spans.queryStart[i], spans.queryEnd[i])) ||
        (kinds & 2 && !validSpan(spans.targetStart[i], spans.targetEnd[i])) ||
        (spans && spans.orientation[i] !== 0 && spans.orientation[i] !== 1 && spans.orientation[i] !== -1) || !Number.isFinite(identity[i]) ||
        identity[i] < 0 || identity[i] > 1 || !Number.isFinite(similarity[i])) {
      throw new TypeError(`Invalid compact link at position ${i}.`);
    }
  }
}
export class CompactLinkStore {
  static get supportsFloat32Scores() { return true; }
  #genes; #query; #target; #identity; #similarity; #spans; #ids; #idPositions; #overrides; #deleted; #fingerprint; #activePositions;
  constructor(input, mode = null) {
    if (mode === sharedColumns) {
      this.#genes = input.#genes; this.#query = input.#query; this.#target = input.#target;
      this.#identity = input.#identity; this.#similarity = input.#similarity;
      this.#spans = input.#spans;
      this.#ids = input.#ids; this.#idPositions = input.#idPositions;
      this.#overrides = new Map(input.#overrides);
      this.#deleted = input.#deleted.slice();
      this.#fingerprint = input.#fingerprint;
      this.#activePositions = input.#activePositions;
      return;
    }
    const { genes, query, target, identity, similarity, spans = null, ids = null } = input;
    // Transferred columns have already been validated before ownership moved.
    if (mode !== transferredColumns) validateCompactColumns({ genes, query, target, identity, similarity, spans, ids });
    this.#ids = ids && Object.freeze([...ids]);
    this.#idPositions = ids && new Map(ids.map((uid, position) => [uid, position]));
    this.#genes = Object.freeze([...genes]);
    this.#query = mode === transferredColumns ? query : query.slice();
    this.#target = mode === transferredColumns ? target : target.slice();
    this.#identity = mode === transferredColumns ? identity : identity.slice();
    this.#similarity = mode === transferredColumns ? similarity : similarity.slice();
    this.#spans = spans && { loci: Object.freeze([...spans.loci]), ...Object.fromEntries(
      ["kinds", "orientation", "queryStart", "queryEnd", "targetStart", "targetEnd"].map((key) => [key, mode === transferredColumns ? spans[key] : spans[key].slice()])) };
    this.#overrides = new Map();
    this.#deleted = [];
    this.#fingerprint = null;
    this.#activePositions = null;
  }
  // Explicit ownership transfer avoids the second copy of large columns.
  // All views of the transferred buffers in the caller become detached.
  static fromTransferred(input) {
    const { genes, query, target, identity, similarity, spans = null, ids = null } = input || {};
    validateCompactColumns({ genes, query, target, identity, similarity, spans, ids });
    const columns = [query, target, identity, similarity, ...(spans ? [spans.kinds, spans.orientation, spans.queryStart, spans.queryEnd, spans.targetStart, spans.targetEnd] : [])];
    if (columns.some((column) => !(column.buffer instanceof ArrayBuffer))) {
      throw new TypeError("Compact link transfer requires transferable ArrayBuffers.");
    }
    const moved = structuredClone({ query, target, identity, similarity, spans },
      { transfer: [...new Set(columns.map((column) => column.buffer))] });
    return new CompactLinkStore({ genes, ids, ...moved }, transferredColumns);
  }
  get size() { return this.#query.length - this.#deleted.length; }
  get geneCount() { return this.#genes.length; }
  get hasSpans() { return Boolean(this.#spans); }
  geneAt(position) { return this.#genes[position]; }
  get byteLength() { return this.#query.byteLength + this.#target.byteLength + this.#identity.byteLength + this.#similarity.byteLength +
    (this.#spans ? ["kinds", "orientation", "queryStart", "queryEnd", "targetStart", "targetEnd"].reduce((sum, key) => sum + this.#spans[key].byteLength, 0) : 0); }
  #deletedBefore(position) {
    let low = 0, high = this.#deleted.length;
    while (low < high) { const middle = (low + high) >>> 1;
      if (this.#deleted[middle] < position) low = middle + 1; else high = middle; }
    return low;
  }
  #physicalForUid(uid) {
    if (this.#idPositions) return this.#idPositions.get(uid);
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
  #uidForPhysical(position) { return this.#ids ? this.#ids[position] : `link-${position}`; }
  uidAt(position) { const physical = this.#physicalAt(position); return physical === undefined ? undefined : this.#uidForPhysical(physical); }
  queryIndexAt(position) { const physical = this.#physicalAt(position); return this.#query[physical]; }
  targetIndexAt(position) { const physical = this.#physicalAt(position); return this.#target[physical]; }
  queryAt(position) { const physical = this.#physicalAt(position); return this.#spans?.kinds[physical] & 1 ? undefined : this.#genes[this.#query[physical]]; }
  targetAt(position) { const physical = this.#physicalAt(position); return this.#spans?.kinds[physical] & 2 ? undefined : this.#genes[this.#target[physical]]; }
  queryLocusAt(position) { const physical = this.#physicalAt(position); return this.#spans?.kinds[physical] & 1 ? this.#spans.loci[this.#query[physical]] : undefined; }
  targetLocusAt(position) { const physical = this.#physicalAt(position); return this.#spans?.kinds[physical] & 2 ? this.#spans.loci[this.#target[physical]] : undefined; }
  #endpointAtPhysical(physical, side) {
    const query = side === "query", span = this.#spans && (this.#spans.kinds[physical] & (query ? 1 : 2));
    const index = (query ? this.#query : this.#target)[physical];
    return span ? { kind: "span", locusId: this.#spans.loci[index], start: this.#spans[`${side}Start`][physical], end: this.#spans[`${side}End`][physical] }
      : { uid: this.#genes[index] };
  }
  endpointAt(position, side) {
    const physical = this.#physicalAt(position);
    return physical === undefined ? undefined : this.#endpointAtPhysical(physical, side);
  }
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
    return { uid: this.#uidForPhysical(physical), query: this.#endpointAtPhysical(physical, "query"),
      target: this.#endpointAtPhysical(physical, "target"), ...(this.#spans?.orientation[physical] ? { orientation: this.#spans.orientation[physical] } : {}), identity: this.#identity[physical],
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
    const addId = (uid) => { if (typeof uid === "number") { add(0xffffffff); addNumber(uid); } else { add(uid.length); for (let i = 0; i < uid.length; i++) add(uid.charCodeAt(i)); } };
    for (const uid of this.#genes) addId(uid);
    for (let i = 0; i < this.#query.length; i++) {
      add(this.#query[i]); add(this.#target[i]);
      addNumber(this.#identity[i]); addNumber(this.#similarity[i]);
    }
    if (this.#spans) {
      add(this.#spans.loci.length);
      for (const uid of this.#spans.loci) addId(uid);
      for (let i = 0; i < this.#query.length; i++) {
        add(this.#spans.kinds[i]); add(this.#spans.orientation[i]);
        if (this.#spans.kinds[i] & 1) { addNumber(this.#spans.queryStart[i]); addNumber(this.#spans.queryEnd[i]); }
        if (this.#spans.kinds[i] & 2) { addNumber(this.#spans.targetStart[i]); addNumber(this.#spans.targetEnd[i]); }
      }
    }
    if (this.#ids) { add(this.#ids.length); for (const uid of this.#ids) addId(uid); }
    return this.#fingerprint = `cl1-${(one >>> 0).toString(16).padStart(8, "0")}${(two >>> 0).toString(16).padStart(8, "0")}`;
  }
  get isUnedited() { return this.#deleted.length === 0 && this.#overrides.size === 0; }
  sharesBase(other) {
    return other instanceof CompactLinkStore && this.#query === other.#query && this.#target === other.#target &&
      this.#identity === other.#identity && this.#similarity === other.#similarity && this.#genes === other.#genes && this.#spans === other.#spans && this.#ids === other.#ids;
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
      updates.push({ uid: this.#uidForPhysical(entry[0]), changes });
    }
    return this.withUpdates(updates).withDeleted([...removed].map((position) => this.#uidForPhysical(position)));
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
  filterEndpoints(geneIds, locusIds = new Set()) {
    const next = new CompactLinkStore(this, sharedColumns), removed = [...this.#deleted];
    for (let position = 0; position < this.size; position++) {
      const physical = this.#physicalAt(position), kinds = this.#spans?.kinds[physical] || 0;
      const query = kinds & 1 ? locusIds.has(this.#spans.loci[this.#query[physical]]) : geneIds.has(this.#genes[this.#query[physical]]);
      const target = kinds & 2 ? locusIds.has(this.#spans.loci[this.#target[physical]]) : geneIds.has(this.#genes[this.#target[physical]]);
      if (!query || !target) removed.push(physical);
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
      const sameEndpoint = (actual, expected) => isPlainObject(actual) && (expected.kind === "span"
        ? actual.kind === "span" && actual.locusId === expected.locusId && actual.start === expected.start && actual.end === expected.end &&
          Object.keys(actual).every((key) => ["kind", "locusId", "start", "end"].includes(key))
        : actual.uid === expected.uid && Object.keys(actual).every((key) => key === "uid"));
      if (deletedIndex < 0 || !isPlainObject(link.query) || !isPlainObject(link.target) ||
          !sameEndpoint(link.query, next.#endpointAtPhysical(physical, "query")) ||
          !sameEndpoint(link.target, next.#endpointAtPhysical(physical, "target")) ||
          (link.orientation ?? 0) !== (next.#spans?.orientation[physical] || 0) || link.similarity !== next.#similarity[physical] ||
          Object.keys(link).some((key) => !["uid", "query", "target", "orientation", "similarity", "identity", "hidden", "label", "colour"].includes(key))) {
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
      if (key === Symbol.for("clustermap.compactLinks")) return store;
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
