import { isPlainObject } from "../utils/values.mjs";
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
const editableFields = new Set(["label", "colour", "hidden", "identity"]);
export class CompactLinkStore {
  #genes; #query; #target; #identity; #similarity; #overrides; #deleted;
  constructor(input, mode = null) {
    if (mode === sharedColumns) {
      this.#genes = input.#genes; this.#query = input.#query; this.#target = input.#target;
      this.#identity = input.#identity; this.#similarity = input.#similarity;
      this.#overrides = new Map(input.#overrides);
      this.#deleted = input.#deleted.slice();
      return;
    }
    const { genes, query, target, identity, similarity } = input;
    if (!Array.isArray(genes) || !genes.every((uid) => typeof uid === "string" && uid.length)) {
      throw new TypeError("Compact links require a gene ID dictionary.");
    }
    if (!(query instanceof Uint32Array) || !(target instanceof Uint32Array) ||
        !(identity instanceof Float64Array) || !(similarity instanceof Float64Array) ||
        query.length !== target.length || query.length !== identity.length || query.length !== similarity.length) {
      throw new TypeError("Compact link columns must be equal-length Uint32/Float64 arrays.");
    }
    for (let i = 0; i < query.length; i++) {
      if (query[i] >= genes.length || target[i] >= genes.length || !Number.isFinite(identity[i]) || identity[i] < 0 || identity[i] > 1 || !Number.isFinite(similarity[i])) {
        throw new TypeError(`Invalid compact link at position ${i}.`);
      }
    }
    this.#genes = Object.freeze([...genes]);
    this.#query = query.slice(); this.#target = target.slice();
    this.#identity = identity.slice(); this.#similarity = similarity.slice();
    this.#overrides = new Map();
    this.#deleted = [];
  }
  get size() { return this.#query.length - this.#deleted.length; }
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
  queryAt(position) { const physical = this.#physicalAt(position); return this.#genes[this.#query[physical]]; }
  targetAt(position) { const physical = this.#physicalAt(position); return this.#genes[this.#target[physical]]; }
  getAt(position) {
    const physical = this.#physicalAt(position);
    if (physical === undefined) return undefined;
    return { uid: `link-${physical}`, query: { uid: this.#genes[this.#query[physical]] },
      target: { uid: this.#genes[this.#target[physical]] }, identity: this.#identity[physical],
      similarity: this.#similarity[physical], ...this.#overrides.get(physical) };
  }
  get(uid) { const position = this.order(uid); return position === undefined ? undefined : this.getAt(position); }
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
    return next;
  }
  filterEndpoints(geneIds) {
    const next = new CompactLinkStore(this, sharedColumns), removed = [...this.#deleted];
    for (let position = 0; position < this.size; position++) {
      if (!geneIds.has(this.queryAt(position)) || !geneIds.has(this.targetAt(position))) removed.push(this.#physicalAt(position));
    }
    next.#deleted = removed.sort((a, b) => a - b);
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
