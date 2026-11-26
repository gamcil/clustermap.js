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
// or an old scene. Arbitrary IDs and edited fields require an overlay, which is
// deliberately not part of this read-only base representation.
export class CompactLinkStore {
  #genes; #query; #target; #identity; #similarity;
  constructor({ genes, query, target, identity, similarity }) {
    if (!Array.isArray(genes) || !genes.every((uid) => typeof uid === "string" && uid.length)) {
      throw new TypeError("Compact links require a gene ID dictionary.");
    }
    if (!(query instanceof Uint32Array) || !(target instanceof Uint32Array) ||
        !(identity instanceof Float64Array) || !(similarity instanceof Float64Array) ||
        query.length !== target.length || query.length !== identity.length || query.length !== similarity.length) {
      throw new TypeError("Compact link columns must be equal-length Uint32/Float64 arrays.");
    }
    for (let i = 0; i < query.length; i++) {
      if (query[i] >= genes.length || target[i] >= genes.length || !Number.isFinite(identity[i]) || !Number.isFinite(similarity[i])) {
        throw new TypeError(`Invalid compact link at position ${i}.`);
      }
    }
    this.#genes = Object.freeze([...genes]);
    this.#query = query.slice(); this.#target = target.slice();
    this.#identity = identity.slice(); this.#similarity = similarity.slice();
  }
  get size() { return this.#query.length; }
  get byteLength() { return this.#query.byteLength + this.#target.byteLength + this.#identity.byteLength + this.#similarity.byteLength; }
  order(uid) {
    if (typeof uid !== "string" || !/^link-(0|[1-9]\d*)$/.test(uid)) return undefined;
    const position = Number(uid.slice(5));
    return Number.isSafeInteger(position) && position < this.size ? position : undefined;
  }
  has(uid) { return this.order(uid) !== undefined; }
  uidAt(position) { return Number.isInteger(position) && position >= 0 && position < this.size ? `link-${position}` : undefined; }
  queryAt(position) { return this.#genes[this.#query[position]]; }
  targetAt(position) { return this.#genes[this.#target[position]]; }
  getAt(position) {
    const uid = this.uidAt(position);
    if (uid === undefined) return undefined;
    return { uid, query: { uid: this.queryAt(position) }, target: { uid: this.targetAt(position) },
      identity: this.#identity[position], similarity: this.#similarity[position] };
  }
  get(uid) { const position = this.order(uid); return position === undefined ? undefined : this.getAt(position); }
  *keys() { for (let i = 0; i < this.size; i++) yield this.uidAt(i); }
  *values() { for (let i = 0; i < this.size; i++) yield this.getAt(i); }
  *entries() { for (let i = 0; i < this.size; i++) { const link = this.getAt(i); yield [link.uid, link]; } }
  [Symbol.iterator]() { return this.entries(); }
}
