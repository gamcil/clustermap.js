import { isPlainObject } from "../utils/values.mjs";

// Serialize synchronously so the chart cannot change between chunks. The Blob
// owns its bytes; no chart-owned objects escape after this function returns.
export function projectBlob(project, { chunkSize = 1024 * 1024 } = {}) {
  const chunks = [], ancestors = new Set();
  let fragments = [], length = 0;
  const flush = () => { if (length) chunks.push(fragments.join("")); fragments = []; length = 0; };
  const append = (part) => {
    fragments.push(part); length += part.length;
    if (length >= chunkSize) flush();
  };
  const write = (value, inArray = false) => {
    if (value === null || typeof value !== "object") {
      if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
        if (inArray) append("null");
        return;
      }
      append(JSON.stringify(value));
      return;
    }
    if (!Array.isArray(value) && !isPlainObject(value)) {
      throw new TypeError("Project export requires JSON-like plain objects and arrays.");
    }
    if (ancestors.has(value)) throw new TypeError("Cannot serialize a circular project.");
    ancestors.add(value);
    if (Array.isArray(value)) {
      append("[");
      for (let i = 0; i < value.length; i++) {
        if (i) append(",");
        const descriptor = Object.getOwnPropertyDescriptor(value, i);
        if (descriptor && !("value" in descriptor)) throw new TypeError("Project export does not support accessors.");
        write(descriptor?.value, true);
      }
      append("]");
    } else {
      append("{");
      let first = true;
      for (const key of Object.keys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!("value" in descriptor)) throw new TypeError("Project export does not support accessors.");
        const child = descriptor.value;
        if (child === undefined || typeof child === "function" || typeof child === "symbol") continue;
        if (!first) append(",");
        first = false;
        append(JSON.stringify(key)); append(":"); write(child);
      }
      append("}");
    }
    ancestors.delete(value);
  };
  write(project);
  flush();
  return new Blob(chunks, { type: "application/json;charset=utf-8" });
}
